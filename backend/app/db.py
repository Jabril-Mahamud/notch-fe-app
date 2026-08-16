import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def database_url() -> str:
    """Built from the same libpq env vars the Helm chart injects, so Compose and
    the cluster hand the backend identical configuration."""
    return (
        f"postgresql+psycopg://{quote_plus(os.environ['PGUSER'])}"
        f":{quote_plus(os.environ['PGPASSWORD'])}"
        f"@{os.environ['PGHOST']}:{os.getenv('PGPORT', '5432')}"
        f"/{os.environ['PGDATABASE']}"
        f"?sslmode={os.getenv('PGSSLMODE', 'prefer')}"
    )


engine = create_engine(database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


def get_db():
    with SessionLocal() as session:
        yield session
