"""Dashboard read models (shapes fixed in docs/CONTRACTS.md)."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StoreOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    store_id: UUID
    tenant_id: UUID
    name: str
    timezone: str


class SummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    store_id: UUID
    date: date
    timezone: str
    enter: int
    exit: int
    occupancy_estimate: int
    last_event_at: datetime | None


class HourBucket(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hour_start: datetime  # store-local, tz-aware
    enter: int
    exit: int


class HourlyOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    store_id: UUID
    date: date
    timezone: str
    buckets: list[HourBucket]


class DeviceOut(BaseModel):
    """Liveness is derived from heartbeats only; last_event_at is visitor activity, not health."""

    model_config = ConfigDict(extra="forbid")
    device_id: UUID
    name: str
    is_active: bool
    last_event_at: datetime | None  # server receive time of the last accepted event batch
    last_heartbeat_at: datetime | None  # server receive time of the last heartbeat; None => status unknown
    source_status: str | None  # "ok" | "source_down" from the last heartbeat
    last_frame_age_s: float | None
    pending_events: int | None
    agent_version: str | None
