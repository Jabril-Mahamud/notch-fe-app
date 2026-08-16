import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import get_db
from .models import Feature, User, Vote

JWT_SECRET = os.environ["NOTCH_JWT_SECRET"]
JWT_TTL = timedelta(days=7)

# Ingress sends /api to this container without stripping the prefix, so every
# route except the probe target lives under /api.
app = FastAPI(title="Notch", docs_url="/api/docs", openapi_url="/api/openapi.json")

# Per-IP. Behind ingress-nginx this is the real client only if the controller
# sets use-forwarded-headers and uvicorn runs with --proxy-headers.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Per-username. slowapi's key_func is sync and runs before the request body is
# read, so the username limit is checked by hand inside the handler.
# ponytail: in-memory, so the budget is per pod. Swap MemoryStorage for
# RedisStorage if the backend ever runs more than one replica.
_username_limiter = MovingWindowRateLimiter(MemoryStorage())
_username_rate = parse("10/minute")

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)


def check_username_rate(username: str) -> None:
    if not _username_limiter.hit(_username_rate, "auth", username.lower()):
        raise HTTPException(429, "too many attempts for this username")


def check_honeypot(value: str) -> None:
    # Real browsers leave the hidden field empty; bots fill every input.
    if value:
        raise HTTPException(400, "rejected")


def issue_token(user: User) -> str:
    payload = {"sub": str(user.id), "exp": datetime.now(timezone.utc) + JWT_TTL}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def current_user_optional(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if creds is None:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return db.get(User, int(payload["sub"]))


def current_user(user: User | None = Depends(current_user_optional)) -> User:
    if user is None:
        raise HTTPException(401, "not authenticated")
    return user


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    website: str = ""  # honeypot


class FeatureIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)
    website: str = ""  # honeypot


class FeatureOut(BaseModel):
    id: int
    title: str
    body: str
    author: str
    votes: int
    voted: bool
    created_at: datetime


@app.get("/health")
def health():
    return {"status": "ok", "env": os.getenv("NOTCH_ENV", "local")}


@app.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, body: Credentials, db: Session = Depends(get_db)):
    check_honeypot(body.website)
    check_username_rate(body.username)

    user = User(username=body.username, password_hash=hasher.hash(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "username taken")
    return {"token": issue_token(user), "username": user.username}


@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, body: Credentials, db: Session = Depends(get_db)):
    check_honeypot(body.website)
    check_username_rate(body.username)

    user = db.scalar(select(User).where(User.username == body.username))
    if user is None:
        # Hash anyway so a missing user costs the same time as a wrong password.
        hasher.hash(body.password)
        raise HTTPException(401, "invalid credentials")
    try:
        hasher.verify(user.password_hash, body.password)
    except VerifyMismatchError:
        raise HTTPException(401, "invalid credentials")
    return {"token": issue_token(user), "username": user.username}


@app.get("/api/features", response_model=list[FeatureOut])
def list_features(
    db: Session = Depends(get_db), me: User | None = Depends(current_user_optional)
):
    votes = (
        select(Vote.feature_id, func.count().label("n"))
        .group_by(Vote.feature_id)
        .subquery()
    )
    rows = db.execute(
        select(Feature, User.username, func.coalesce(votes.c.n, 0))
        .join(User, User.id == Feature.author_id)
        .outerjoin(votes, votes.c.feature_id == Feature.id)
        .order_by(func.coalesce(votes.c.n, 0).desc(), Feature.created_at.desc())
    ).all()

    mine: set[int] = set()
    if me is not None:
        mine = set(db.scalars(select(Vote.feature_id).where(Vote.user_id == me.id)))

    return [
        FeatureOut(
            id=f.id,
            title=f.title,
            body=f.body,
            author=author,
            votes=n,
            voted=f.id in mine,
            created_at=f.created_at,
        )
        for f, author, n in rows
    ]


@app.post("/api/features", status_code=201)
@limiter.limit("20/hour")
def create_feature(
    request: Request,
    body: FeatureIn,
    db: Session = Depends(get_db),
    me: User = Depends(current_user),
):
    check_honeypot(body.website)
    feature = Feature(title=body.title, body=body.body, author_id=me.id)
    db.add(feature)
    db.commit()
    return {"id": feature.id}


@app.post("/api/features/{feature_id}/vote")
def toggle_vote(
    feature_id: int, db: Session = Depends(get_db), me: User = Depends(current_user)
):
    if db.get(Feature, feature_id) is None:
        raise HTTPException(404, "no such feature")

    existing = db.get(Vote, {"feature_id": feature_id, "user_id": me.id})
    if existing is None:
        db.add(Vote(feature_id=feature_id, user_id=me.id))
    else:
        db.execute(
            delete(Vote).where(Vote.feature_id == feature_id, Vote.user_id == me.id)
        )
    db.commit()

    n = db.scalar(
        select(func.count()).select_from(Vote).where(Vote.feature_id == feature_id)
    )
    return {"votes": n, "voted": existing is None}
