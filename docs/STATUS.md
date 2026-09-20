# STATUS — read this first

**Active stage:** Stage 4 tooling complete; first real YOLOX-S run on the reference clip done. **Next:** field measurement (real door camera + manual tally → accuracy numbers), see bottom of file.

## Stage 3 — Dashboard (done 2026-06; visual redesign 2026-06)
### Redesign (2026-06) — light theme, charcoal rail, subtle glass
- Tokens live in `frontend/src/index.css` (`:root` CSS variables: `--bg #F3F4F6`, `--surface`, `--glass` 84 % white + 16 px blur with solid `@supports` fallback, `--text/--text-2`, `--ink #202124`, `--emerald #047857`, `--exit #64748B`, warn/danger, radii 22/12 px, `--dur 180ms`) and are exposed to Tailwind as `canvas / surface / txt / line / ink / emerald-brand / exit / warn / danger` in `tailwind.config.js`. Component classes: `.card`, `.glass`, `.ctl` (+`-ink` selected/primary, `-ghost`), `.rail-item`, `.tnum`, `.fade-in`; `prefers-reduced-motion` disables motion.
- Files: `components/dashboard/{AppShell (72 px rail + mobile top bar, Radix tooltip), PageHeader, Toolbar, KpiCards, HourlyChart, DeviceList, States (Error/Stale/Empty/NoStores), Skeletons}.tsx`, `hooks/useMediaQuery.ts`, `pages/Dashboard.tsx` (explicit state machine: stores pending → skeleton; stores failed → error; no stores; day loading → skeleton; day failed without data → error; data + failed refresh → stale banner + old data). `Header.tsx` removed.
- Copy changes: KPI "Estimasi di dalam" → **"Selisih masuk–keluar"** (explicitly *not* occupancy); device statuses are event-based only: `Event baru < 5 mnt` / `Belum ada event baru` / `Belum pernah mengirim event` / `Nonaktif` (no "Live/Online", API-key prefix removed from UI). Navigation contains only the one existing page.
- Test IDs kept: `store-selector-dropdown, date-prev/next/today-button, date-picker-trigger, manual-refresh-button, kpi-enter-count, kpi-exit-count, kpi-last-event-at, hourly-chart-container, hourly-chart-tooltip, hourly-empty-note, device-list-card, device-item-row, device-status-badge[data-status], device-last-seen, error-state-container, error-retry-button, empty-state-container, no-stores-container, timezone-badge, last-updated-time, selected-date-label`. Renamed `kpi-occupancy-estimate` → `kpi-net-count`. New: `nav-rail, nav-dashboard-link, mobile-topbar, dashboard-toolbar, refreshing-indicator, stale-data-banner, stale-retry-button, dashboard-skeleton, hourly-unavailable-note, device-unavailable, device-empty`.
- Checks actually run: `npx tsc --noEmit` clean; `CI=true yarn craco test src/lib/time.test.ts` → 5 passed; `CI=true yarn craco build` → compiled successfully (production bundle in `frontend/build`, git-ignored); screenshots at 1920/1440/768/390 with `scrollWidth == innerWidth` (no horizontal overflow); data/tooltip/error/stale/skeleton states exercised with Playwright route interception (synthetic JSON, labelled SINTETIS, never written to the DB). Independent QA (testing agent, iteration_5): all scenarios passed, `count_events` = 0 afterwards.
- Not verified: WCAG contrast measured only by token choice (#52525B on #F8FAFC ≈ 7:1, #71717A hints ≈ 4.6:1 on white), not by an automated audit; the native `<input type=date>` still renders in browser-locale order.

### What exists (`frontend/`, React 19 + TypeScript, CRA/craco, Tailwind, Recharts, TanStack Query)
- `tsconfig.json` (strict, `allowJs` for the shadcn `.jsx` primitives; `jsconfig.json` removed — CRA forbids both). Template `App.js/index.js/App.css` deleted.
- `src/api/types.ts` (mirror of `docs/CONTRACTS.md` dashboard shapes), `src/api/client.ts` (fetch via `REACT_APP_BACKEND_URL`, optional `REACT_APP_DASHBOARD_KEY` → `X-Dashboard-Key`), `src/lib/time.ts` (store-timezone helpers via `Intl`, stale threshold 5 min) + `time.test.ts`, `src/hooks/useDashboardData.ts` (30 s polling), `src/hooks/useNow.ts`, `src/components/dashboard/{Header,KpiCards,HourlyChart,DeviceList,States}.tsx`, `src/pages/Dashboard.tsx`.
- Behaviour: store selector (`REACT_APP_STORE_ID` optional default), date navigation in store tz (no future dates), KPI Masuk/Keluar/Estimasi di dalam (labelled estimate, may be negative)/Event terakhir (store-local time), 24-bucket grouped bar chart, device list with Aktif / Tidak terlihat >5 mnt / Nonaktif badges, honest empty state ("angka nyata dari server (0), bukan contoh"), error state with retry, "diperbarui x lalu · auto 30s". UI copy in Bahasa Indonesia. All interactive/critical elements carry `data-testid`.

### Tests actually run (2026-06)
- `cd frontend && CI=true yarn craco test --watchAll=false src/lib/time.test.ts` → **5 passed** (today-in-tz across midnight, addDays month boundary, local time formatting, stale threshold, relative time/hour label).
- `webpack compiled successfully`, TypeScript "No issues found".
- Screenshot of the live preview: KPIs 0/0/0/—, empty-state banner, 24 zero buckets, device `dev-pilot-01` shown as stale (last ingest 24 min earlier) — i.e. real server values, no mock data.
- Independent QA (testing agent, browser automation on the public URL): 8/8 scenarios passed — empty state, live ingest → KPIs 2/1/+1 + WIB time + chart tooltip + device active, manual refresh, prev/next/today/date-picker, backend outage → error state → retry recovery, mobile 390×844 & desktop no overflow. Test events deleted afterwards (0 rows remain).

### NOT done / not verified
- No component/e2e tests in the repo yet (only pure helpers); UI verified by screenshot + testing agent (see below).
- Chart tooltip content only tested manually. Date input renders in browser locale format (native `<input type=date>`).
- Read endpoints still unauthenticated in the preview (ADR-013).

## Stage 2 — Backend (done 2026-06)
### What exists (`backend/`, see `backend/README.md`)
- `app/config.py` (env only: `DATABASE_URL`, `CORS_ORIGINS`, `DASHBOARD_READ_KEY`, `AUTO_CREATE_SCHEMA`), `app/db.py` (SQLAlchemy 2 async), `app/models.py` (tenants, stores, devices, cameras, count_lines, count_events — mirrors `docs/DATA_MODEL.md`; `UTCDateTime` type keeps everything tz-aware UTC on SQLite and PostgreSQL), `app/contracts.py` (copy of edge contract, drift-tested), `app/auth.py` (device key `dk_<key_id>.<secret>`, sha256, constant-time; optional dashboard read key), `app/routers/events.py` (idempotent batch ingest, per-event savepoint, unknown/cross-tenant camera → `rejected`), `app/routers/stores.py` (list, summary, hourly, devices; store-timezone bucketing), `app/seed.py` (operator CLI, idempotent, prints key once), Alembic (`migrations/`, initial rev `7f0ed43c997e`), `Dockerfile`, root `docker-compose.yml` + `.env.compose.example`.
- `server.py` is now a 2-line entry point (`uvicorn server:app`) — Mongo template code removed. `MONGO_URL`/`DB_NAME` remain in `.env` untouched but unused.
- Preview DB: SQLite at `backend/data/people_counter.sqlite3`, migrated with Alembic, seeded with tenant "Pilot Tenant" / store "Toko Pilot" (Asia/Jakarta) / device `dev-pilot-01` / camera `cam-door-front`. Key + ids in `memory/seed_output.json` (git-ignored; never commit it).

### Tests actually run (2026-06)
- `cd backend && python -m pytest tests -q` → **19 passed** (auth 401/403/malformed, accept→duplicate incl. in-batch, unknown camera rejected, cross-tenant camera rejected + other store unaffected, `tenant_id` in payload → 422, naive ts → 422, empty batch → 422, `last_seen_at` updated & key never returned, timezone bucketing Asia/Jakarta incl. midnight rollover, store list/404, default date, dashboard read key, contract drift, real edge `EventSender` → app incl. duplicate-on-retry and wrong key → `auth_failed`).
- Manual: `alembic upgrade head` on fresh SQLite OK; seed run twice → second run issued no key (idempotent); real `EventSender` over the public preview URL → 3 accepted, summary showed enter=2/exit=1, device `last_seen_at` set. Those 3 synthetic rows were then deleted so the pilot DB holds no fictional data.
- Independent QA (testing agent): `backend/tests/qa_live_api.py` → 12/12 passed against the public preview URL; test rows cleaned up (0 `count_events` remain).
- Edge suite still green: `cd edge_agent && pytest tests/ tests/qa_verifications.py` → 51 + 21 passed.

### NOT done / not verified
- **PostgreSQL path not executed here** (no Docker in this workspace). Code uses only portable SQLAlchemy constructs (`Uuid`, `DateTime(timezone=True)`, savepoints); `asyncpg` is installed. First `docker compose up` on the user's machine is the real test — check `alembic upgrade head` output.
- No rate limiting, no request size limit beyond `MAX_BATCH_SIZE=500`, no device heartbeat endpoint (edge health JSON is local only).
- Dashboard read endpoints are open in the preview (`DASHBOARD_READ_KEY` unset) — pilot decision, ADR-013.

## Stage 1 — Edge agent core (done 2026-06)
### What exists
- `edge_agent/` Python package (see `edge_agent/README.md`, `docs/ARCHITECTURE.md`):
  video sources (file / RTSP with reconnect / synthetic), `Detector` + `Tracker` protocols, `YoloxOnnxDetector` (ONNX Runtime, lazy import), `ScriptedDetector`, `IouTracker`, `DirectedLine` + `CrossingCounter` (hysteresis, per-track state), `EventStore` (SQLite WAL, capacity), `EventSender` (batch, Bearer, backoff+jitter, ack-only mark-sent), `HealthState` + health JSON, `CounterPipeline`, YAML+env config, CLI (`run/status/schema`).
- `contracts/event_v1.schema.json` generated from `edge_agent/edge_agent/contracts.py`.
- Docs: `AGENTS.md`, `docs/{ARCHITECTURE,DATA_MODEL,DECISIONS,CONTRACTS,STATUS}.md`.

### Tests actually run (2026-06, this workspace, Python 3.11, numpy 2.4, opencv-headless 5.0, httpx 0.28, pydantic 2.13)
`cd edge_agent && python -m pytest -q` → **51 passed**. Coverage of required behaviours:
- line geometry / sides / normalized coords / enter_side flip (`test_line.py`)
- counter: enter, exit, deadband jitter → 0, single-frame blips → 0, exit→re-enter same track → 2 events, new id on other side → 0, TTL expiry, brief loss same side → 0, multi-track independence, no count from box count alone (`test_counter.py`)
- tracker: id persistence, distinct ids, expiry + new id, short occlusion via prediction (`test_iou_tracker.py`)
- store: persist-before-send + reopen, PK dedup, capacity raises (no drop), mark_sent only after ack frees capacity, FIFO, rejected kept, purge (`test_event_store.py`)
- sender (httpx MockTransport fake idempotent server): happy path, same `event_id` across network/503 retries, exponential backoff values and cap, duplicates ack = sent, 401 → `auth_failed` (kept pending), server-rejected → `rejected`, malformed ack → not sent, API key absent from logs (`test_sender.py`)
- pipeline end-to-end with synthetic frames: enter+exit, detector flicker → no phantom, buffer full → loud + health `buffer_full`, two people opposite directions, `event_ts` from frame time base (`test_pipeline.py`)
- contracts: committed schema == models, tz-aware required, `tenant_id` in payload rejected; redaction; YOLOX NMS/letterbox/postprocess math (`test_contracts_and_misc.py`); `FileVideoSource` on a generated MJPG clip (`test_file_source.py`)
- Manual smoke: `python -m edge_agent.cli run --config <synthetic cfg>` → 30 frames, health file written, exit 0. RTSP source against an unreachable URL: credentials not present in logs.
- Independent QA pass (separate testing agent): `tests/qa_verifications.py` → **21 passed**, no issues found. Run all with `pytest tests/` (the file is deliberately outside the `test_*.py` glob).

### NOT done / not verified — do not claim otherwise
- **No real video and no model weights were used.** `YoloxOnnxDetector` has never been executed against a real ONNX file here (onnxruntime not installed in this workspace). Field accuracy: **unmeasured**.
- RTSP tested only for redaction + reconnect loop exit; not against a live camera.
- Weights license for YOLOX checkpoints: needs legal confirmation (ADR-003).
- `IouTracker` is a baseline; ID switches in crowds will cause undercounts (by design, ADR-005).
- Hysteresis is in normalized units → anisotropic for non-square frames (acceptable for a pilot; revisit if lines are diagonal on wide frames).
- No backend exists yet; `EventSender` is verified only against the in-test fake server implementing `docs/CONTRACTS.md`.

## Stage 2 — Backend (done; see top of file)

## Stage 3 — Dashboard (done; see top of file)

## Stage 4 — Field pilot (tooling done 2026-06; field measurement NOT done)
### What exists
- `edge_agent/edge_agent/tools/`: `calibrate` (`snapshot` grid image, `preview` line + ENTER arrow), `annotate` (real pipeline on a recording → annotated video + events JSONL + SQLite store), `evaluate` (per-direction greedy time matching vs a manual `truth.csv`, markdown + JSON report), `overlay` (drawing helpers). `source.frame_stride` config knob. `deploy/edge-agent.service` (systemd). `docs/PILOT_RUNBOOK.md` (placement → calibration → dry run → throughput → service → ground-truth protocol → acceptance proposal). `config.review.vtest.yaml` + `review/truth.template.csv`.
- ADR-016 (headless tooling, manual-ground-truth-only accuracy), ADR-017 (reference clip `vtest.avi`).

### Tests actually run (2026-06, this workspace, Python 3.11, onnxruntime 1.30.0, opencv-headless 5.0)
- `cd edge_agent && python -m pytest tests/ -q` → **58 passed** (51 Stage-1 + `test_evaluate.py` + `test_overlay.py`); `tests/qa_verifications.py` → **21 passed**. `cd backend && python -m pytest tests -q` → **19 passed**.
- **First real-model run** — `python -m edge_agent.tools.annotate --config config.review.vtest.yaml --out review/vtest_review.avi --events review/vtest_events.jsonl` with the official YOLOX-S ONNX export (`sha256 c5c2d13e…998063`) on OpenCV `vtest.avi` (`sha256 45cddc94…0516cf`, 795 frames @ 10 fps, `frame_stride: 2`, config `sha256 f118f7e9…c51b48`): completed, `frames_processed=398`, wall time 251.9 s → **`fps_processed=1.58`** on this 4-vCPU container (≈ 0.63 s per YOLOX-S 640×640 CPU inference). Agent output: **12 `enter`, 14 `exit`, 26 events**, health `status: ok`, `buffer_pending: 26` (send disabled), 0 rejected, 0 lost. Deterministic: a second run produced the identical event list (same frames/tracks). 7 tracks produced more than one event (`track_id` 19 → 3 events; 22, 23, 32, 35, 36, 49 → 2 each): the vertical review line runs through the lamp post at x=0.5, so occlusion/re-cross behaviour around the post is exercised. Spot-checked review frames: line, ENTER arrow, per-track boxes/ids, IN/OUT flash and running counts render correctly; at least one unboxed pedestrian visible in frame 316 (detector miss at conf 0.4).
- `calibrate snapshot` / `preview` on the same config → 768×576 PNGs written from frame 0.
- These counts are **agent output only, not accuracy** (ADR-017): `vtest.avi` is a plaza, not a door, and has no manual tally. `review/truth.template.csv` is intentionally empty; `evaluate` has only been run on synthetic fixtures in `tests/test_evaluate.py`.

### NOT done / not verified — do not claim otherwise
- **No accuracy number exists.** Requires a real door camera + observer tally per `docs/PILOT_RUNBOOK.md` §7. Fill "Measured results" there and this section only with those numbers.
- No live RTSP camera used. Throughput 1.58 fps here means a 4-core edge box must use `frame_stride` 2–3 at 5 fps sub-stream or a smaller model (runbook §5); not measured on target hardware.
- `review/` artefacts (video, JSONL, SQLite, PNGs, logs) and `models/`, `samples/` are git-ignored; regenerate with the commands above.
