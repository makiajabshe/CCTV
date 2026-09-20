# Backend (FastAPI + SQLAlchemy 2 async)

PostgreSQL in production (Docker Compose), SQLite in the hosted preview — same code, `DATABASE_URL` decides.

## Run locally with Docker Compose (repo root)
```bash
cp .env.compose.example .env.compose   # set POSTGRES_PASSWORD, CORS_ORIGINS, optional DASHBOARD_READ_KEY
docker compose --env-file .env.compose up --build
# api: http://localhost:8001/api/health  (migrations run automatically: alembic upgrade head)
docker compose --env-file .env.compose exec api \
  python -m app.seed --tenant "My Tenant" --contact-email you@example.com \
  --store "Store 1" --timezone Asia/Jakarta --camera cam-door-front --device dev-01
# -> prints device_api_key_SHOW_ONCE once; put it in the edge agent's EDGE_API_KEY
```

## Run without Docker
```bash
cd backend && pip install -r requirements.txt
export DATABASE_URL=sqlite+aiosqlite:///./data/people_counter.sqlite3   # or postgresql+asyncpg://...
alembic upgrade head
uvicorn server:app --host 0.0.0.0 --port 8001
```

## Env vars
| var | required | notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql+asyncpg://…` or `sqlite+aiosqlite:///…` |
| `CORS_ORIGINS` | no | comma-separated; empty → `*` (pilot) |
| `DASHBOARD_READ_KEY` | no | if set, `/api/v1/stores*` require header `X-Dashboard-Key` |
| `AUTO_CREATE_SCHEMA` | no | `true` only for throwaway dev DBs; production uses Alembic |

## Migrations
`alembic revision --autogenerate -m "..."` then review the file (replace `app.models.UTCDateTime(...)` with `sa.DateTime(timezone=True)` if autogenerate emits it) → `alembic upgrade head`.

## Tests
```bash
cd backend && python -m pytest tests -q
```
Includes: device auth (401/403), idempotent ingest, tenant isolation, payload identity spoof → 422, timezone bucketing (Asia/Jakarta), dashboard read key, contract drift vs `contracts/event_v1.schema.json`, and the real edge `EventSender` against the in-process app.
