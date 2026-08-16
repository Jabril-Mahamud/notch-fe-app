# notch-fe-app

The Notch application: FastAPI backend, Next.js frontend, and the CI that pushes
both images to ECR. Three repos, split by lifecycle:

| Repo | Holds |
|---|---|
| [notch](https://github.com/Jabril-Mahamud/notch) | `cluster.yaml`, the `notch-app` chart |
| [notch-gitops](https://github.com/Jabril-Mahamud/notch-gitops) | ArgoCD root, addons, Crossplane resources, per-service values |
| **notch-fe-app** (this one) | This application and its CI |

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

## CI

`.github/workflows/build.yml` runs on push to `main`, builds both images and
pushes `dev-<sha>` and `dev-latest` to ECR. No stored AWS keys: it assumes
`notch-gha-ecr` through GitHub's OIDC provider.

One-time bootstrap, before the first push:

```bash
aws sso login --profile kreator-admin
AWS_PROFILE=kreator-admin ./.github/aws/bootstrap.sh
```

That creates the `notch-frontend` and `notch-backend` repositories, the OIDC
provider, and the role. The repositories are created by hand deliberately, so CI
has somewhere to push before Crossplane has ever run — `ecr-repos.yaml` in
`notch-gitops` carries matching `crossplane.io/external-name` annotations so
Crossplane adopts them instead of failing on `RepositoryAlreadyExistsException`.

Trust is scoped to `repo:Jabril-Mahamud/notch-fe-app:ref:refs/heads/main`.
Rename the repo or build from another branch and the assume-role fails — edit
`.github/aws/trust-policy.json` and re-run the script.

Confirm real images exist before spinning up a cluster:

```bash
aws ecr list-images --repository-name notch-backend  --region eu-west-1
aws ecr list-images --repository-name notch-frontend --region eu-west-1
```

## Migrations

Alembic runs on container start (`alembic upgrade head` in the backend `CMD`).
New migration:

```bash
docker compose exec backend alembic revision --autogenerate -m "what changed"
```
