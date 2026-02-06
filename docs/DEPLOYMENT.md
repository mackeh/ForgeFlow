# ForgeFlow Deployment Guide

This guide covers local deployment, production hardening checks, and Kubernetes starter manifests.

## 1. Local Deployment (Docker Compose)

## Prerequisites
- Docker Engine + Docker Compose plugin
- Linux desktop automation hosts:
  - X11 available
  - `xhost` utility for local container auth

## Start locally

```bash
./start.sh
```

`start.sh` performs:
- `.env` bootstrap from `.env.example`
- optional X11 auth (`xhost +local:`)
- image pull + rebuild (unless `AUTO_UPDATE=0`)
- Prisma migration
- full stack startup

## Stop

```bash
docker compose down
```

## 2. Production Configuration

## Required secrets
- `APP_USERNAME`
- `APP_PASSWORD` or `APP_PASSWORD_HASH_ARGON2`
- `JWT_SECRET`
- `SECRET_ENCRYPTION_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `OLLAMA_BASE_URL`
- `AGENT_BASE_URL`

## Recommended production env overrides
- `NODE_ENV=production`
- `PLAYWRIGHT_HEADLESS=true`
- `TRUST_PROXY=true` (behind reverse proxy/load balancer)
- `LOG_LEVEL=info` (or `warn` in high-volume clusters)
- `REQUEST_LOGS=1`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=300` (adjust per load profile)
- `RATE_LIMIT_LOGIN_MAX=25` (lower for internet-facing auth)

## Data persistence
- PostgreSQL volume backups (critical)
- Server data files (`/app/data/*.json`) backup/replication plan
- Artifacts retention/cleanup policy (`/app/artifacts`)
- Ollama model cache persistence (`/root/.ollama`) optional but recommended

## 3. Production Checklist

Use this checklist before go-live:

- [ ] Rotate all default credentials and secrets.
- [ ] Put API/web behind HTTPS reverse proxy or ingress with TLS.
- [ ] Restrict access to `/metrics` and admin endpoints to trusted networks.
- [ ] Configure regular PostgreSQL backups + restore drills.
- [ ] Configure backup for file stores (`authz`, `schedules`, `webhooks`, `audit`, `integrations`, `collaboration`).
- [ ] Set resource limits/requests for server, web, agent, and Ollama.
- [ ] Validate health/readiness probes in orchestrator.
- [ ] Enable centralized log collection (JSON logs from server).
- [ ] Define alerting on:
  - high `run.failed` ratio
  - repeated auth failures / lockouts
  - readiness probe failures
- [ ] Verify desktop automation host display access (`DISPLAY`, X11 auth) if using desktop nodes.
- [ ] Verify TOTP setup flow and emergency admin recovery process.
- [ ] Run smoke suite:
  - login
  - workflow create/publish
  - test run + production run
  - manual approval + resume flow
  - schedule run-now

## 4. Upgrade / Rollback Strategy

## Upgrade
1. Backup DB and data files.
2. Pull latest images and rebuild:
   ```bash
   docker compose pull
   docker compose build --pull --no-cache server web agent
   ```
3. Run migrations:
   ```bash
   docker compose run --rm --no-deps server npm run prisma:migrate
   ```
4. Deploy and validate `/ready`.

## Rollback
1. Re-deploy previous known-good image tags/commit.
2. Restore DB/data backups if migration rollback is not possible.
3. Validate login, run execution, and scheduler state.

## 5. Kubernetes Starter Manifests

Starter manifests are provided at:

- `deploy/k8s/forgeflow-starter.yaml`

This file contains:
- Namespace
- ConfigMap
- Secret template (`stringData`)
- PostgreSQL StatefulSet + PVC + Service
- Redis Deployment + Service
- Ollama StatefulSet + PVC + Service
- Server Deployment + Service (with liveness/readiness)
- Web Deployment + Service
- Agent Deployment + Service
- Ingress example routing `/api` to server and `/` to web

Apply:

```bash
kubectl apply -f deploy/k8s/forgeflow-starter.yaml
```

Important:
- Replace all placeholder secrets before applying.
- Add TLS cert-manager configuration to ingress.
- If desktop automation is required in Kubernetes, ensure nodes support display forwarding and update agent deployment accordingly.

## 6. Post-Deploy Verification

```bash
curl -sS http://<api-host>/health
curl -sS http://<api-host>/ready
curl -sS http://<api-host>/metrics | head -n 20
```

Then perform an end-to-end test run from UI:
- create workflow
- publish
- run
- review diagnostics
- confirm dashboard metrics update
