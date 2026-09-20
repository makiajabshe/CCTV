# Decisions (ADR log)

Format: context → decision → consequences / rejected alternatives. Append; never rewrite history. Supersede with a new ADR.

## ADR-001 — Monorepo layout and staged delivery (2026-06)
Stages: (1) edge agent core + tests, (2) backend FastAPI+PostgreSQL+Docker Compose, (3) dashboard React+TS, (4) RTSP field pilot. Each stage must be runnable on its own and end with `docs/STATUS.md` updated. Layout: `edge_agent/`, `backend/`, `frontend/`, `contracts/`, `docs/`.

## ADR-002 — Event contract SSOT lives in `edge_agent/edge_agent/contracts.py`
Pydantic v2 models generate `contracts/event_v1.schema.json`; a test fails if the committed file drifts. Backend (Stage 2) re-declares the same Pydantic models and MUST add a test comparing its `model_json_schema()` with the committed file. Frontend types (Stage 3) are generated from the same JSON schema. Rationale: avoid the usual multi-copy drift. Versioning: `schema_version` literal; breaking changes → `CountEventV2` + new file, never in-place edits.

## ADR-003 — Person detector: YOLOX via ONNX Runtime (licenses verified 2026-06)
Verified from official sources:
- **YOLOX** (Megvii-BaseDetection/YOLOX): code **Apache-2.0**. Official checkpoints are distributed from that repo; however GitHub issue #1865 shows an open community question about whether the weights are explicitly covered by Apache-2.0. → **Action before commercial launch:** get written confirmation or legal sign-off; fallback is training/exporting our own weights or using RT-DETR (Apache-2.0, PaddleDetection / lyuwenyu) — both fit the same `Detector` interface.
- **onnxruntime**: MIT. **opencv-python-headless**: Apache-2.0. **numpy/httpx/pydantic/PyYAML**: permissive.
- **Rejected: Ultralytics YOLOv8/YOLO11** — AGPL-3.0; Ultralytics states AGPL applies to code, architectures *and* trained weights, including edge/SaaS deployment, unless an Enterprise License is purchased. Incompatible with a closed-source subscription product without paying for the license.
- COCO-pretrained weights are trained on COCO images (CC-BY-4.0 annotations; image rights vary). This is an industry-standard risk, noted but not mitigated at pilot stage.
Weights are **not** bundled in the repo; operators export ONNX themselves per the YOLOX docs. **No accuracy has been measured for this project**.

## ADR-004 — Tracker: dependency-free IoU tracker baseline, ByteTrack later
`IouTracker` (constant-velocity prediction, greedy IoU matching, `min_hits`, `max_age`) ships as the baseline behind the `Tracker` protocol so the counter can be tested deterministically without model dependencies. Upgrade path: **ByteTrack** — original repo (ifzhang/ByteTrack) MIT; Roboflow `supervision` MIT (its built-in `sv.ByteTrack` is deprecated since 0.28 in favour of the separate `trackers` package — check that package's license before adopting). **Rejected: boxmot** (AGPL-3.0).

## ADR-005 — Counting semantics: directed line + per-track hysteresis, UNKNOWN initial side
See `docs/ARCHITECTURE.md` → "Counting semantics". Key choice: a track must first be confirmed on one side before it can ever produce a crossing, so track-loss/re-id can only undercount, never overcount. Preferred failure mode for a paying customer: missed count over phantom count. Anchor defaults to bbox bottom-center (feet) — the point that actually crosses a floor line under a typical overhead-angled camera.

## ADR-006 — Identity from authentication, never from payload
Edge payload contains `camera_id` and `line_id` strings only. `tenant_id/store_id/device_id` are resolved server-side from the device API key; `CountEventV1` uses `extra="forbid"` so a spoofed `tenant_id` field is rejected at parse time on the edge and must be rejected by the backend.

## ADR-007 — Reliability: SQLite write-ahead buffer with explicit failure
`events(event_id PK, payload, status pending|sent|rejected, attempts, created_at, sent_at, last_error)`, WAL + `synchronous=FULL`. Persist before send; mark `sent` only on server ack (`accepted` or `duplicates`); `rejected` rows are kept for inspection. Capacity applies to pending rows; when full, `append` raises `BufferFullError` and the pipeline logs `EVENT LOST` at ERROR and sets health `buffer_full`. Alternative "block the pipeline until space frees" was rejected because it silently stalls counting; explicit loss with a counter is more honest for a pilot and can be revisited (e.g., disk-based overflow).

## ADR-008 — Time: UTC everywhere in storage; store timezone for display
`event_ts` is derived from the frame time base (file: `start_ts_utc + index/fps`; RTSP: capture wall clock). Server adds `received_at`. All timestamps tz-aware UTC; `datetime.utcnow()` is banned.

## ADR-009 — Backend persistence: SQLAlchemy 2.x async + PostgreSQL; SQLite in preview
User requirement is PostgreSQL via Docker Compose on their machine. The hosted preview workspace cannot run Docker and ships MongoDB; we will **not** build on Mongo. Stage 2 uses SQLAlchemy 2.x async with a `DATABASE_URL` env var: `postgresql+asyncpg://…` in Compose, `sqlite+aiosqlite://…` in the preview. Schema identical (Alembic migrations). The current `backend/server.py` is the untouched platform template and will be replaced in Stage 2.

## ADR-010 — Device auth: per-device API key, hashed at rest, Bearer header
Pilot-appropriate. Key shown once at device creation; server stores a hash + prefix. Hashing algorithm and rotation flow to be finalized in Stage 2 via the auth integration playbook. Rejected for now: mTLS (ops burden for a pilot), JWT device tokens (adds a token-issuance flow with no pilot benefit).

## ADR-011 — Secrets only via environment; redaction in logs
`EDGE_API_KEY`, `EDGE_RTSP_URL` from env; `.env` git-ignored; `edge_agent.redact` used for URLs/Bearer tokens; CLI log formatter redacts `Bearer …`. Tests assert the API key never appears in logs.

## ADR-012 — Device key format & hashing (finalizes ADR-010, 2026-06)
Token `dk_<key_id>.<secret>` (`secrets.token_urlsafe`, 9 + 32 bytes). DB stores `key_id` (indexed, public) and `sha256(secret)` hex; lookup by `key_id`, compare with `secrets.compare_digest` against a dummy hash when the key is unknown (uniform timing). SHA-256 is appropriate because the secret is 256 random bits (not a human password) — no bcrypt/argon2 needed. Revocation = `is_active=false` (403); rotation = issue new device, switch, deactivate old. Provisioning is a CLI (`app/seed.py`), never an HTTP endpoint.

## ADR-013 — Dashboard read endpoints: open for the pilot, optional shared read key
User chose "no login for pilot". To avoid shipping a permanently open multi-tenant API, `/api/v1/stores*` accept an optional `DASHBOARD_READ_KEY` (header `X-Dashboard-Key`). Unset in the preview. Proper per-user auth with tenant scoping is P2 and must not change the response shapes in `docs/CONTRACTS.md`.

## ADR-014 — Day/hour aggregation computed in Python over an indexed UTC range
Store-local day → `[start_utc, end_utc)` via `zoneinfo`; events fetched with `ix_count_events_store_ts`; bucketed by local hour in Python. Portable across SQLite/PostgreSQL (SQLite has no `AT TIME ZONE`) and handles DST correctly. One store-day is at most thousands of rows. Revisit with SQL `date_trunc(... AT TIME ZONE ...)` or a materialized hourly table when multi-store/month views arrive.

## ADR-015 — Schema management: Alembic (async env), `AUTO_CREATE_SCHEMA` only for dev
Compose runs `alembic upgrade head` before uvicorn. Initial revision `7f0ed43c997e`. `create_all` is gated by `AUTO_CREATE_SCHEMA=true` for throwaway DBs/tests only.

## ADR-016 — Field-pilot tooling is headless and evaluation is manual-ground-truth only (2026-06)
Edge boxes have no display, so calibration is `snapshot` (grid overlay) + `preview` (line + ENTER arrow) images, not a GUI. Visual verification uses `tools/annotate` (annotated review video + events JSONL). Accuracy is computed **only** by `tools/evaluate` against a human tally CSV (per-direction greedy time matching, ±tolerance). The repo must never contain accuracy numbers that were not produced this way. `source.frame_stride` was added so CPU-bound boxes can process every Nth frame; tracker/counter frame windows are in processed frames.

## ADR-017 — Reference clip for review runs: OpenCV `vtest.avi`
Public sample from the OpenCV repo (Apache-2.0), 768×576 @ 10 fps, 795 frames, pedestrians on a plaza. Used to exercise the real YOLOX-S + IoU tracker + counter end to end. It is **not** a door scene and has **no ground-truth tally**, so its counts are agent output only, never accuracy. Not committed (8 MB); download command in `config.review.vtest.yaml`.
