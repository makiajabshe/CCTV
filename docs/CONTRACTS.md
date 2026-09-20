# Contracts (HTTP API) — SSOT for the API surface

Payload shapes: `contracts/event_v1.schema.json` (generated; see ADR-002). All endpoints are under `/api`.

## Edge → Backend
### `POST /api/v1/events/batch`
- Auth: `Authorization: Bearer dk_<key_id>.<secret>` (ADR-012). Server resolves `device → store → tenant`. 401 unknown/invalid key, 403 inactive device.
- Body: `EventBatchRequestV1` — `{ "events": [CountEventV1, ...] }`, 1..500 items.
- Response 200: `EventBatchResponseV1`
  ```json
  { "accepted": ["<event_id>"], "duplicates": ["<event_id>"], "rejected": [{"event_id": "...", "reason": "unknown camera"}] }
  ```
  - `accepted`: newly stored. `duplicates`: `event_id` already existed (idempotent; nothing changed). Both mean "edge may mark sent".
  - `rejected`: per-event validation failure the edge cannot fix by retrying (unknown camera, camera not in device's store). Edge keeps them as `rejected` locally.
- 400/422: whole body malformed (edge keeps batch pending, backs off, logs). 429/5xx: retry with backoff.
- Server sets `received_at = now()`; never trusts identity fields from the body (they are not in the schema; unknown fields → 422).

### `CountEventV1` fields
`schema_version=1, event_id (uuid4), event_type ("enter"|"exit"), event_ts (UTC ISO-8601, tz-aware), camera_id (external string), line_id (external string), track_id (int ≥0), frame_index (int ≥0), source_kind ("file"|"rtsp"|"synthetic")`.

## Dashboard → Backend (Stage 2 — built; Stage 3 consumes)
- All `/api/v1/stores*` endpoints: if `DASHBOARD_READ_KEY` is configured on the server, require header `X-Dashboard-Key: <key>` (401 otherwise). Unset for the pilot preview (ADR-013).
- `GET /api/v1/stores` → `[{ store_id, tenant_id, name, timezone }]`
- `GET /api/v1/stores/{store_id}/summary?date=YYYY-MM-DD` → `{ store_id, date, timezone, enter, exit, occupancy_estimate, last_event_at }`
  - `date` interpreted in the store timezone; defaults to today in that timezone. `occupancy_estimate = enter - exit` for that day (may be negative; label as estimate). `last_event_at` is the latest `event_ts` for the store overall (UTC ISO) or null.
- `GET /api/v1/stores/{store_id}/hourly?date=YYYY-MM-DD` → `{ store_id, date, timezone, buckets: [{ hour_start (store-local ISO with offset), enter, exit }] }` — 24 buckets, zero-filled.
- `GET /api/v1/stores/{store_id}/devices` → `[{ device_id, name, api_key_prefix, is_active, last_seen_at }]` (`last_seen_at` = last successful ingest).
- `GET /api/health` → `{ status: "ok" }` (always public).
- Unknown `store_id` → 404.
Pilot has no user login (user choice); `store_id` comes from dashboard config. Adding user auth later must not change these shapes.

## Edge local health file (`health_file`)
```json
{ "status": "ok|degraded|source_down|auth_failed|buffer_full", "transport_status": "...", "transport_error": null,
  "source_status": "ok|source_down", "buffer_pending": 0, "buffer_capacity": 50000, "buffer_rejected": 0,
  "events_lost_buffer_full": 0, "frames_processed": 0, "enter_count": 0, "exit_count": 0, "updated_at": "UTC ISO" }
```
