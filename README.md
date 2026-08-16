# notch-fe-app

The Notch application: FastAPI backend, Next.js frontend. The chart, cluster
config and GitOps manifests live in the `notch` and `notch-gitops` repos.

## Run it

```bash
docker compose up --build -d
./smoke.sh          # register, submit, vote, restart, verify it survived
```

Frontend on http://localhost:3000, backend on http://localhost:8000.
Set `FRONTEND_PORT` in `.env` if 3000 is taken.

## Contracts with the chart

These are fixed by `notch/charts/notch-app` and
`notch-gitops/services/notch/service.yaml`. Changing them breaks the deploy.

| Thing | Value | Why |
|---|---|---|
| Backend port | 8000 | `containers.backend.ports[http]` |
| Frontend port | 3000 | `containers.frontend.ports[http]` |
| Probe path | `/health` at the root | both probes point here |
| API routes | under `/api` | the ingress rule does **not** strip the prefix |
| DB config | `PGHOST` `PGPORT` `PGDATABASE` `PGSSLMODE` `PGUSER` `PGPASSWORD` | chart injects exactly these, so Compose uses them too |
| Image user | numeric, non-root | `podSecurityContext.runAsNonRoot: true` |

`NOTCH_JWT_SECRET` is required. In the cluster it arrives via the ExternalSecret,
so create it before deploying:

```bash
aws secretsmanager create-secret --name notch/dev/apps/notch/NOTCH_JWT_SECRET \
  --secret-string "$(openssl rand -base64 32)" --region eu-west-1
```

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | – |
| POST | `/api/auth/register` | – |
| POST | `/api/auth/login` | – |
| GET | `/api/features` | optional (sets `voted`) |
| POST | `/api/features` | bearer |
| POST | `/api/features/{id}/vote` | bearer, toggles |

Auth routes are rate limited per IP (slowapi) and per username, and every form
carries a `website` honeypot field that must be empty.

## Migrations

Alembic runs on container start (`alembic upgrade head` in the backend `CMD`).
New migration:

```bash
docker compose exec backend alembic revision --autogenerate -m "what changed"
```
