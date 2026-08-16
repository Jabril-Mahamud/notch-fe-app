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

# --proxy-headers so get_remote_address sees X-Forwarded-For rather than the
# ingress-nginx pod IP. Needs use-forwarded-headers on the controller too.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
