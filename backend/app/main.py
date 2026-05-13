import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.database import ensure_indexes
from app.location_routes import router as location_router
from app.plot_routes import router as plot_router
from app.rate_limit import limiter
from app.routes import router as auth_router
from app.scan_routes import router as scan_router
from app.upload_routes import router as upload_router
from app.walk_routes import router as walk_router

settings = get_settings()
logger = logging.getLogger(__name__)
MAX_UPLOAD_REQUEST_BYTES = 16 * 1024 * 1024


if settings.environment.lower() == "production" and settings.email_debug_otp:
    raise RuntimeError("EMAIL_DEBUG_OTP cannot be enabled in production.")


def rate_limit_exception_handler(_request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again shortly."},
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not settings.skip_db_init:
        try:
            ensure_indexes()
        except Exception:  # pragma: no cover - defensive startup logging
            logger.exception("Failed to initialize MongoDB indexes.")
    try:
        from app.ai_service import get_gemini_client
        get_gemini_client()  # warm + log which backend is active
    except Exception:  # pragma: no cover
        logger.exception("Gemini client warm-up failed.")
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)
app.add_middleware(SlowAPIMiddleware)
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
app.include_router(scan_router, prefix=settings.api_prefix)
app.include_router(upload_router, prefix=settings.api_prefix)
app.include_router(plot_router, prefix=settings.api_prefix)
app.include_router(location_router, prefix=settings.api_prefix)
app.include_router(walk_router, prefix=settings.api_prefix)


@app.middleware("http")
async def upload_size_guard(request: Request, call_next):
    if request.url.path.endswith("/upload"):
        content_length = request.headers.get("content-length")
        try:
            request_size = int(content_length or 0)
        except ValueError:
            request_size = 0
        if request_size > MAX_UPLOAD_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Upload one to three photos totaling 16 MB or less."},
            )
    return await call_next(request)


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
