FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# podSecurityContext.runAsNonRoot is set in services/notch/service.yaml. The
# kubelet cannot resolve a username to a UID, so `USER notch` would still fail
# the check with CreateContainerConfigError - the USER must be numeric.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin notch
USER 10001

EXPOSE 8000

# X-Forwarded-For is deliberately NOT trusted yet. Behind ingress-nginx the
# per-IP limiter keys on the ingress pod IP, so it is effectively one shared
# budget - the per-username limiter is what actually bites until this is done.
#
# To turn it on, all three of these have to land together:
#   1. use-forwarded-headers=true on the ingress-nginx controller
#   2. uvicorn --proxy-headers --forwarded-allow-ips=<ingress pod CIDR>
#   3. never --forwarded-allow-ips='*' - that trusts the header from any peer,
#      so a client spoofs X-Forwarded-For and gets a fresh rate-limit bucket
#      per forged IP, which defeats the per-IP limit entirely.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
