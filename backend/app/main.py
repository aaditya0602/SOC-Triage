import logging
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .api.alerts import router as alerts_router
from .api.auth_router import router as auth_router
from .api.incidents import router as incidents_router
from .api.stats import router as stats_router
from .auth import hash_password
from .config import get_settings
from .database import Base, SessionLocal, engine
from .ingest.router import router as ingest_router
from .models import User
from .ws import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


async def seed_default_user() -> None:
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.username == settings.analyst_username))
        if existing is None:
            db.add(User(
                username=settings.analyst_username,
                password_hash=hash_password(settings.analyst_password),
                role="analyst",
            ))
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_default_user()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ingest_router)
app.include_router(alerts_router)
app.include_router(incidents_router)
app.include_router(stats_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "llm_provider": settings.llm_provider}


@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket, token: str = ""):
    try:
        jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive pings from client
    except WebSocketDisconnect:
        manager.disconnect(websocket)
