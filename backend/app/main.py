from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .db import Database
from .models import Base
from .auth import LoginThrottle
from .routers import auth, devices, events, stores

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(settings.database_url)
        if settings.auto_create_schema:  # dev/preview only; production uses `alembic upgrade head`
            async with db.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        app.state.db = db
        app.state.settings = settings
        app.state.login_throttle = LoginThrottle()
        try:
            yield
        finally:
            await db.dispose()

    app = FastAPI(title="People Counter API", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(auth.router)
    app.include_router(events.router)
    app.include_router(devices.router)
    app.include_router(stores.router)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app
