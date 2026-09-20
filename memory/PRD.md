# PRD — AI CCTV People Counter (subscription SaaS), MVP

## Original problem statement (verbatim intent)
Build an MVP people counter: count people entering/exiting through one door with one camera, process video on an edge device, show results on a dashboard. Scope: one store, one camera (pilot); recorded video first, then RTSP; pretrained person detector + tracker; no face recognition, no training, no heatmap/queue/POS/payments. Prepare `tenant_id, store_id, camera_id, device_id` for SaaS growth. Edge agent in Python (video input, detector, tracker, crossing counter, SQLite, HTTPS sender). Backend FastAPI + PostgreSQL (Docker Compose). Dashboard React + TypeScript. Swappable detector/tracker interfaces. Verify licenses before choosing dependencies. Directed-line crossing with normalized coords, per-track state + hysteresis, no box-count counting, same track may count again on real re-cross, track id ≠ identity, track loss must not create phantom crossings, event ts ≠ server receive ts, UTC storage / store tz display. Reliability: persist to SQLite before send, stable event_id across retries, idempotent backend, mark sent only after ack, backoff + bounded buffer, loud failure when buffer full, no secrets in repo/logs, identity from server auth, edge dials out.

## User choices (2026-06)
- Start with Stage 1 (edge agent core + tests). Backend: SQLAlchemy 2 async + PostgreSQL via Compose; SQLite in preview. Detector: agent decides after license verification (→ YOLOX/ONNX Runtime, ADR-003). Device auth: per-device API key (hashed, Bearer). Dashboard: no login for pilot. Strong emphasis on: foundations first, scalable design, no duplication/hallucination, clear DB relations, SSOT, context continuity for AI sessions.

## Personas
- Store owner / manager: sees daily enter/exit and hourly pattern for their store.
- Operator (us): installs edge device, configures camera + line, monitors device health.
- Future: multi-store tenant admin.

## Architecture (see docs/ARCHITECTURE.md)
Edge (Python) → HTTPS `/api/v1/events/batch` → Backend (FastAPI + PostgreSQL) ← Dashboard (React/TS). Contract SSOT: `edge_agent/edge_agent/contracts.py` → `contracts/event_v1.schema.json`.

## Implemented
- 2026-06 — Stage 1 edge agent core + 51 passing tests (synthetic fixtures only) + project memory docs (`AGENTS.md`, `docs/*`). Details: `docs/STATUS.md`.
- 2026-06 — Stage 2 backend: FastAPI + SQLAlchemy 2 async (PostgreSQL via Compose / SQLite preview), Alembic, device API-key auth, idempotent ingest, tenant-scoped camera validation, summary/hourly/devices endpoints in store timezone, seed CLI, 19 backend tests + edge↔backend integration test.
- 2026-06 — Stage 3 dashboard: React 19 + TypeScript, store selector, date navigation in store timezone, KPI cards, 24-hour chart, device health with stale badge, honest empty/error states, 30 s polling. 5 helper tests.
- 2026-06 — Stage 4 tooling: headless `calibrate` (snapshot/preview), `annotate` (review video + events JSONL), `evaluate` (vs manual truth CSV), `frame_stride`, systemd unit, `docs/PILOT_RUNBOOK.md`. First real YOLOX-S ONNX run on OpenCV `vtest.avi`: 398 frames processed at 1.58 fps (CPU), 12 enter / 14 exit — agent output only, **no accuracy measured** (no ground truth). Edge 58 + 21 QA tests, backend 19 tests green.
- 2026-06 — Dashboard visual redesign: light theme tokens (CSS variables → Tailwind), 72 px charcoal nav rail + mobile top bar, glass toolbar, KPI "Selisih masuk–keluar" (not occupancy), event-based device status wording, skeleton / refreshing / stale-banner / error / empty states. Verified by tsc, 5 unit tests, screenshots at 1440/768/390, testing agent (iteration_5) — no fictional data written.

## Backlog (prioritized)
- P0 Field measurement: real door RTSP camera, observer tally per `docs/PILOT_RUNBOOK.md` §7, `evaluate` → numbers into STATUS/runbook.
- P1 ByteTrack adapter (MIT) behind `Tracker` protocol; legal confirmation of YOLOX weights license.
- P2 Device key rotation, user login, multi-store tenant views, heartbeat endpoint with edge health snapshot.

## Not in scope (MVP)
Face recognition, model training, heatmaps, queue analytics, POS, billing/payments.
