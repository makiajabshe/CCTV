"""POST /api/auth/login, GET /api/auth/me — dashboard user sessions (JWT Bearer)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, create_access_token, get_session, load_current_user, require_user, verify_password
from ..models import DashboardUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: UUID
    email: str
    tenant_ids: list[UUID]


class LoginOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


def _user_out(u: CurrentUser) -> UserOut:
    return UserOut(user_id=u.user_id, email=u.email, tenant_ids=sorted(u.tenant_ids, key=str))


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> LoginOut:
    settings = request.app.state.settings
    if settings.dashboard_auth == "disabled":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Login is disabled (DASHBOARD_AUTH=disabled)")
    email = body.email.lower()
    key = f"{request.client.host if request.client else '?'}:{email}"
    throttle = request.app.state.login_throttle
    if throttle.is_locked(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts; try again later")
    user = (await session.execute(select(DashboardUser).where(DashboardUser.email == email))).scalar_one_or_none()
    ok = verify_password(body.password, user.password_hash if user else None)
    if not ok or user is None or not user.is_active:
        throttle.record_failure(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    throttle.clear(key)
    token, expires_in = create_access_token(user, settings.jwt_secret, settings.jwt_ttl_minutes)
    current = await load_current_user(session, user.id)
    assert current is not None
    return LoginOut(access_token=token, expires_in=expires_in, user=_user_out(current))


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[CurrentUser, Depends(require_user)]) -> UserOut:
    return _user_out(user)
