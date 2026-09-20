"""POST /api/v1/devices/heartbeat — device liveness, scoped to the authenticated device only."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_session, require_device
from ..contracts import HeartbeatAckV1, HeartbeatV1
from ..models import Device

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])


@router.post("/heartbeat", response_model=HeartbeatAckV1)
async def heartbeat(
    body: HeartbeatV1,
    device: Annotated[Device, Depends(require_device)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> HeartbeatAckV1:
    received_at = datetime.now(timezone.utc)  # server clock; body.sent_at is informational only
    device.last_heartbeat_at = received_at
    device.hb_source_status = body.source_status
    device.hb_last_frame_age_s = body.last_frame_age_s
    device.hb_pending_events = body.pending_events
    device.hb_tracking_session_id = body.tracking_session_id
    device.hb_agent_version = body.agent_version
    await session.commit()
    return HeartbeatAckV1(received_at=received_at)
