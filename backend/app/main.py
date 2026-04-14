import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import ensure_indexes
from app.routes import router as auth_router

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not settings.skip_db_init:
        try:
            ensure_indexes()
        except Exception:  # pragma: no cover - defensive startup logging
            logger.exception("Failed to initialize MongoDB indexes.")
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(auth_router, prefix=settings.api_prefix)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
