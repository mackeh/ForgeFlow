# ForgeFlow API Reference

Base URL (local): `http://localhost:8080`

## 1. Authentication, Headers, and Permissions

## Auth flow
- Authenticate with `POST /api/auth/login`.
- Use returned JWT token in all protected requests:
  - `Authorization: Bearer <token>`
- Token TTL: 12 hours.

## Default roles
- `admin`: `*` (all permissions)
- `operator`: `workflows:read`, `workflows:write`, `workflows:execute`, `workflows:approve`, `schedules:manage`, `templates:read`, `metrics:read`, `secrets:read`, `secrets:write`
- `viewer`: `workflows:read`, `templates:read`, `metrics:read`, `secrets:read`

## Common response behavior
- `2xx`: success
- `400`: invalid payload/validation error
- `401`: missing/invalid token (or invalid credentials on login)
- `403`: missing permission
- `404`: resource not found
- `428`: TOTP required on login
- `429`: rate limit or temporary auth lock
- `503`: startup/shutdown/readiness failure

## 2. Public Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Service health with dependency checks |
| GET | `/ready` | No | Readiness probe for startup/shutdown gating |
| GET | `/metrics` | No | Prometheus metrics text output |
| POST | `/api/auth/login` | No | Local login (username/password + optional TOTP) |

## 3. Auth Endpoints (JWT required)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/auth/me` | Any authenticated user | Returns resolved auth context |
| GET | `/api/auth/2fa/status` | Any authenticated user | Returns 2FA enabled/setup state |
| POST | `/api/auth/2fa/setup` | Any authenticated user | Begins TOTP setup |
| POST | `/api/auth/2fa/verify-setup` | Any authenticated user | Confirms TOTP setup |
| POST | `/api/auth/2fa/disable` | Any authenticated user | Disables TOTP |

## 4. System/Utility

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/system/time` | Any authenticated user | Returns UTC + configured local schedule time |
| POST | `/api/system/preflight` | `workflows:execute` | Validates workflow definition/workflowId before run |

## 5. Templates, Activities, and Autopilot

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/templates` | `templates:read` | List built-in workflow templates |
| GET | `/api/activities` | `templates:read` | List activity catalog (available + planned packs) |
| POST | `/api/autopilot/plan` | `workflows:write` | Generate workflow draft definition from natural-language prompt |
| POST | `/api/workflows/from-template` | `workflows:write` | Create workflow from template |

## 6. Document Intelligence and Orchestrator

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/document/understand` | `workflows:execute` | Extract key fields/entities from raw document text |
| GET | `/api/orchestrator/overview` | `workflows:execute` | Robot/job overview counters |
| GET | `/api/orchestrator/robots` | `workflows:execute` | List robots |
| POST | `/api/orchestrator/robots` | `workflows:execute` | Create robot |
| PUT | `/api/orchestrator/robots/:id` | `workflows:execute` | Update robot |
| GET | `/api/orchestrator/jobs` | `workflows:execute` | List queued/dispatched/completed jobs |
| POST | `/api/orchestrator/jobs` | `workflows:execute` | Create queued orchestrator job |
| POST | `/api/orchestrator/jobs/:id/dispatch` | `workflows:execute` | Dispatch queued job to run engine |
| POST | `/api/orchestrator/jobs/:id/sync` | `workflows:execute` | Sync job status from linked run |

## 7. Workflows and Collaboration

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/workflows` | `workflows:read` | List workflows |
| POST | `/api/workflows` | `workflows:write` | Create workflow |
| PUT | `/api/workflows/:id` | `workflows:write` | Update workflow name and/or draft definition |
| DELETE | `/api/workflows/:id` | `workflows:write` | Delete workflow and related schedules |
| POST | `/api/workflows/:id/publish` | `workflows:write` | Publish draft definition |
| GET | `/api/workflows/:id/versions` | `workflows:read` | List workflow versions |
| POST | `/api/workflows/:id/rollback` | `workflows:write` | Roll back to version |
| GET | `/api/workflows/:id/history` | `workflows:read` | Combined workflow version + audit history view |
| GET | `/api/workflows/:id/collab/presence` | `workflows:read` | List active collaborators |
| GET | `/api/workflows/:id/comments` | `workflows:read` | List workflow comments |
| POST | `/api/workflows/:id/comments` | `workflows:write` | Add comment |
| DELETE | `/api/workflows/:id/comments/:commentId` | `workflows:write` | Delete comment (author/admin) |
| GET | `/api/workflows/:id/runs` | `workflows:read` | List recent runs for workflow |

## 8. Runs and Approvals

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/runs/start` | `workflows:execute` | Start test/prod run, optionally resume previous failed run |
| GET | `/api/runs/:id` | `workflows:read` | Get run detail (node states, logs, context, artifacts) |
| POST | `/api/runs/:id/approve` | `workflows:approve` | Approve/reject waiting approval node |
| GET | `/api/runs/:id/diff-last-success` | `workflows:read` | Compare run node states to last successful baseline |

## 9. Scheduling

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/schedules` | `schedules:manage` | List schedules (optionally by workflowId) |
| GET | `/api/schedules/presets` | `schedules:manage` | List schedule presets |
| GET | `/api/schedules/upcoming` | `schedules:manage` | Build upcoming run calendar preview |
| GET | `/api/schedules/preview` | `schedules:manage` | Validate cron + timezone and preview next run |
| POST | `/api/schedules` | `schedules:manage` | Create schedule |
| PUT | `/api/schedules/:id` | `schedules:manage` | Update schedule |
| DELETE | `/api/schedules/:id` | `schedules:manage` | Delete schedule |
| POST | `/api/schedules/:id/run-now` | `schedules:manage` | Trigger schedule immediately |

## 10. Integrations

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/integrations` | `workflows:write` | List integration profiles |
| POST | `/api/integrations` | `workflows:write` | Create integration profile |
| PUT | `/api/integrations/:id` | `workflows:write` | Update integration profile |
| DELETE | `/api/integrations/:id` | `workflows:write` | Delete integration profile |
| POST | `/api/integrations/:id/test` | `workflows:write` | Connectivity test for profile |
| POST | `/api/integrations/import/csv` | `workflows:write` | Parse CSV text/file into structured rows |

## 11. Metrics and Mining

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/metrics/dashboard` | `metrics:read` | Aggregated dashboard metrics (runs/schedules/resources) |
| GET | `/api/mining/summary` | `metrics:read` | Process/task mining summary (bottlenecks, variants, opportunities) |

## 12. Admin (Users, Roles, Audit)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/admin/users` | `users:manage` | List users |
| POST | `/api/admin/users` | `users:manage` | Create user |
| PUT | `/api/admin/users/:username` | `users:manage` | Update role/password/disabled flag |
| DELETE | `/api/admin/users/:username` | `users:manage` | Delete user |
| GET | `/api/admin/roles` | `roles:manage` | List role permission sets |
| PUT | `/api/admin/roles/:role` | `roles:manage` | Upsert role permissions |
| GET | `/api/admin/audit` | `audit:read` | Query audit events with filters |

## 13. Webhooks

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/webhooks/events` | `webhooks:manage` | List supported event types |
| GET | `/api/webhooks` | `webhooks:manage` | List webhook subscriptions |
| POST | `/api/webhooks` | `webhooks:manage` | Create webhook subscription |
| PUT | `/api/webhooks/:id` | `webhooks:manage` | Update webhook subscription |
| DELETE | `/api/webhooks/:id` | `webhooks:manage` | Delete webhook subscription |
| POST | `/api/webhooks/:id/test` | `webhooks:manage` | Send synthetic test event |

## 14. Secrets

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/secrets` | `secrets:read` | List secret keys/metadata |
| POST | `/api/secrets` | `secrets:write` | Create or update encrypted secret |

## 15. Recorders

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/recorders/web/start` | `workflows:write` | Starts web recorder session |
| POST | `/api/recorders/web/stop` | `workflows:write` | Stops web recorder session and returns captured events |
| POST | `/api/recorders/desktop/start` | `workflows:write` | Starts desktop recorder session |
| POST | `/api/recorders/desktop/stop` | `workflows:write` | Stops desktop recorder session |

## 16. WebSocket Endpoints

Base WS URL: `ws://localhost:8080/ws`

| Channel Type | URL Query | Description |
|---|---|---|
| Recorder | `?type=recorder&sessionId=<id>` | Streams recorder events (`recorder:ready`, `recorder:event`) |
| Collaboration | `?type=collab&workflowId=<id>&token=<jwt>` | Live workflow presence (`collab:ready`, `collab:presence`, `collab:pong`) |

## 17. Payload and Usage Examples

## Login

```bash
curl -sS http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"local","password":"localpass"}'
```

Response:

```json
{
  "token": "<jwt>",
  "user": {
    "username": "local",
    "role": "admin",
    "permissions": ["*"]
  }
}
```

## Create Workflow

```bash
curl -sS http://localhost:8080/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Invoice Sync"}'
```

## Autopilot Plan

```bash
curl -sS http://localhost:8080/api/autopilot/plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Open website, scrape invoice table, clean with AI, and send to API"}'
```

## Document Understanding

```bash
curl -sS http://localhost:8080/api/document/understand \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Invoice Number: INV-1001\nTotal: $1200.00","expectedFields":["invoice_number","total_amount"]}'
```

## Start Test Run

```bash
curl -sS http://localhost:8080/api/runs/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"<workflow-id>","testMode":true,"inputData":{"source":"demo"}}'
```

## Approve Manual Step

```bash
curl -sS http://localhost:8080/api/runs/<run-id>/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"manual_approval_1","approved":true}'
```

## Schedule Preview

```bash
curl -sS "http://localhost:8080/api/schedules/preview?cron=0%209%20*%20*%201-5&timezone=Europe/Stockholm" \
  -H "Authorization: Bearer $TOKEN"
```

## Create Schedule

```bash
curl -sS http://localhost:8080/api/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId":"<workflow-id>",
    "name":"Weekday 09:00",
    "cron":"0 9 * * 1-5",
    "timezone":"Europe/Stockholm",
    "enabled":true
  }'
```

## Create Integration

```bash
curl -sS http://localhost:8080/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Orders API",
    "type":"http_api",
    "config":{"baseUrl":"https://api.example.com","headers":{"X-Key":"abc"}}
  }'
```

## Queue Orchestrator Job

```bash
curl -sS http://localhost:8080/api/orchestrator/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"<workflow-id>","mode":"unattended","testMode":true}'
```

## Mining Summary

```bash
curl -sS "http://localhost:8080/api/mining/summary?days=14" \
  -H "Authorization: Bearer $TOKEN"
```

## Create Webhook

```bash
curl -sS http://localhost:8080/api/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Ops Alerts",
    "url":"https://hooks.example.com/forgeflow",
    "events":["run.failed","run.waiting_approval"],
    "enabled":true
  }'
```

## Upsert Secret

```bash
curl -sS http://localhost:8080/api/secrets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"CRM_PASSWORD","value":"super-secret"}'
```

## 17. Notes for Integrators

- `/api/*` is rate limited. Tune with:
  - `RATE_LIMIT_WINDOW_MS`
  - `RATE_LIMIT_MAX`
  - `RATE_LIMIT_LOGIN_MAX`
- Use `x-request-id` on requests for traceability; if omitted, server generates one.
- `/metrics` is intentionally unauthenticated for scraping. Restrict network access in production.
