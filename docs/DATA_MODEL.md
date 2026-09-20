# Data model (server side, PostgreSQL) — SSOT for Stage 2 models

All ids are UUIDv4. All timestamps `timestamptz` stored in UTC. Every table except `tenants` carries `tenant_id` for tenant isolation and cheap row-level filtering.

```
tenants 1──* stores 1──* cameras 1──* count_lines
                  │           ▲
                  └──* devices ┘ (camera.device_id → devices.id; a camera is processed by exactly one device)
count_events *──1 cameras, *──1 devices, *──1 stores, *──1 tenants
```

## Tables
### tenants
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | unique |
| contact_email | text nullable | owner/operator contact |
| created_at | timestamptz | |

### stores
| id | uuid pk |
| tenant_id | uuid fk tenants |
| name | text | unique per tenant |
| timezone | text | IANA, e.g. `Asia/Jakarta`; used for display/aggregation buckets |
| created_at | timestamptz |

### devices  (edge agents)
| id | uuid pk |
| tenant_id | uuid fk tenants |
| store_id | uuid fk stores | must belong to `tenant_id` |
| name | text |
| key_id | text unique | public part of `dk_<key_id>.<secret>`; indexed lookup (ADR-012) |
| secret_hash | text | sha256 hex of the secret only (never the token) |
| api_key_prefix | text | first 12 chars of the token, for support lookup only |
| is_active | bool |
| last_seen_at | timestamptz nullable |
| created_at | timestamptz |

### cameras
| id | uuid pk |
| tenant_id | uuid fk tenants |
| store_id | uuid fk stores |
| device_id | uuid fk devices nullable | the device allowed to post events for this camera |
| external_id | text | == `camera_id` string in edge payload; **unique per store** |
| name | text |
| created_at | timestamptz |

### count_lines  (server copy of line config; optional in Stage 2, needed for dashboard overlay later)
| id | uuid pk |
| tenant_id, camera_id | fks |
| external_id | text | == `line_id` in payload; unique per camera |
| ax, ay, bx, by | double | normalized |
| enter_side | text | `left` / `right` |

### count_events
| col | type | notes |
|---|---|---|
| event_id | uuid pk | client-generated; **idempotency key** |
| tenant_id | uuid fk | from auth |
| store_id | uuid fk | from auth (device.store_id) |
| device_id | uuid fk | from auth |
| camera_id | uuid fk cameras | resolved from payload `camera_id` (external_id) within device's store |
| line_id | text | payload `line_id` (external string) |
| event_type | enum `enter`/`exit` | |
| event_ts | timestamptz | from payload (edge time) |
| received_at | timestamptz | server `now()` |
| track_id | int | local tracker id, not an identity |
| frame_index | int | |
| source_kind | text | `file`/`rtsp`/`synthetic` |
| schema_version | smallint | |

Indexes: `(store_id, event_ts)`, `(camera_id, event_ts)`, `(tenant_id, event_ts)`.

## Invariants the backend must enforce
1. Tenant/store/device on `count_events` come **only** from the authenticated device row.
2. `camera_id` in payload must resolve to a camera with `store_id == device.store_id` (and `device_id == device.id` if set), else the event is `rejected` with reason `unknown camera`.
3. Insert is idempotent on `event_id`: existing row → report in `duplicates`, do not update.
4. Aggregations bucket `event_ts AT TIME ZONE stores.timezone`.
5. No deletes of `count_events` through the API in the MVP.
