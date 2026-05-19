"""HTTP routes for the Walk Scan feature.

The frontend records a short video, extracts frames client-side at ~3 FPS,
and posts them here. We run anomaly scoring (see ``walk_inference.py``) and
optionally let Gemini turn the result into farmer-friendly language.

Heavy work runs through ``asyncio.to_thread`` so the event loop stays
responsive while DINOv2 chews through a batch on CPU.

Note: do NOT add ``from __future__ import annotations`` here. FastAPI 0.116
needs the request-body annotations to be resolvable at decoration time so
it can recognize the Pydantic body parameter; PEP 563 stringified
annotations break body detection and the route falls back to expecting
``{"payload": {...}}`` wrappers.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.ai_service import generate_walk_summary
from app.dependencies import get_current_user
from app.rate_limit import limiter
from app.walk_inference import (
    MAX_FRAMES,
    WalkInferenceError,
    analyze_walk,
    warmup_walk_model,
)

router = APIRouter(prefix="/walk-scan", tags=["walk-scan"])
logger = logging.getLogger(__name__)

# Frames arrive as base64 data URLs; cap each one slightly above the inference
# layer's per-frame byte limit so the route can reject obvious abuse early
# without re-decoding.
MAX_DATA_URL_CHARS = 360_000


class WalkFrame(BaseModel):
    index: int = Field(ge=0, le=200)
    timestampMs: int = Field(ge=0, le=120_000)
    capturedAt: str | None = Field(default=None, max_length=40)
    dataUrl: str = Field(min_length=32, max_length=MAX_DATA_URL_CHARS)


class WalkAnalyzeRequest(BaseModel):
    frames: list[WalkFrame] = Field(min_length=1, max_length=MAX_FRAMES)
    calibrationIndexes: list[int] = Field(min_length=1, max_length=30)


class WalkFrameResult(BaseModel):
    index: int
    timestampMs: int
    capturedAt: str | None = None
    status: str
    anomalyScore: float | None
    level: str | None
    greenRatio: float
    blurScore: float
    leafDetected: bool = False
    leafConfidence: float | None = None
    leafLabel: str | None = None


class WalkAnalyzeResponse(BaseModel):
    framesAnalyzed: int
    validFrameCount: int
    skippedFrameCount: int
    calibrationFrameCount: int
    anomalyMean: float
    anomalyStdev: float
    frames: list[WalkFrameResult]
    suspiciousIndexes: list[int]


class WalkSummaryRequest(BaseModel):
    framesAnalyzed: int = Field(ge=0)
    validFrameCount: int = Field(ge=0)
    skippedFrameCount: int = Field(ge=0)
    calibrationFrameCount: int = Field(ge=0)
    anomalyMean: float = Field(ge=0, le=1)
    anomalyStdev: float = Field(ge=0, le=1)
    suspiciousWindows: list[dict] = Field(default_factory=list, max_length=10)
    cropContext: str | None = Field(default=None, max_length=120)


class WalkSummaryResponse(BaseModel):
    summary: str


class WalkWarmupResponse(BaseModel):
    ready: bool
    coldStart: bool
    durationSeconds: float


@router.post("/analyze", response_model=WalkAnalyzeResponse)
@limiter.limit("6/minute")
async def analyze_walk_endpoint(
    request: Request,
    payload: WalkAnalyzeRequest,
    _current_user: dict = Depends(get_current_user),
) -> WalkAnalyzeResponse:
    frames_payload = [frame.model_dump() for frame in payload.frames]
    calibration = list(payload.calibrationIndexes)
    try:
        result = await asyncio.to_thread(analyze_walk, frames_payload, calibration)
    except WalkInferenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        logger.exception("Walk Scan inference runtime failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Walk Scan model could not be loaded. The first request downloads "
                "DINOv2 and YOLO weights and needs internet access."
            ),
        ) from exc
    except Exception as exc:
        logger.exception("Walk Scan inference unexpected failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Walk Scan analysis failed. Check backend logs.",
        ) from exc
    return WalkAnalyzeResponse(**result)


@router.post("/warmup", response_model=WalkWarmupResponse)
@limiter.limit("3/minute")
async def warmup_walk_endpoint(
    request: Request,
    _current_user: dict = Depends(get_current_user),
) -> WalkWarmupResponse:
    """Pre-load DINOv2 weights so the first real Walk Scan does not pay the
    download cost. Idempotent: subsequent calls return immediately because
    the model bundle is cached for the process lifetime.
    """

    try:
        result = await asyncio.to_thread(warmup_walk_model)
    except RuntimeError as exc:
        logger.exception("Walk Scan warmup failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Walk Scan model could not be loaded. The first call downloads "
                "DINOv2 and YOLO weights and needs internet access."
            ),
        ) from exc
    return WalkWarmupResponse(**result)


@router.post("/summary", response_model=WalkSummaryResponse)
@limiter.limit("12/minute")
async def summarize_walk_endpoint(
    request: Request,
    payload: WalkSummaryRequest,
    _current_user: dict = Depends(get_current_user),
) -> WalkSummaryResponse:
    summary = await asyncio.to_thread(
        generate_walk_summary,
        payload.model_dump(),
    )
    return WalkSummaryResponse(summary=summary)
