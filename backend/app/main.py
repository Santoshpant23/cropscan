import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import ensure_indexes
from app.routes import router as auth_router
from app.upload_routes import router as upload_router

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
    ],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(upload_router, prefix=settings.api_prefix)
app.include_router(upload_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request, exc: RequestValidationError
) -> JSONResponse:
    message = "; ".join(
        f"{'.'.join(str(part) for part in error['loc'][1:])}: {error['msg']}"
        for error in exc.errors()
    )
    return JSONResponse(status_code=422, content={"detail": message})


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
