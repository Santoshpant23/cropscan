"""Walk Scan route tests.

We only exercise the request-validation surface and the auth gate. The DINOv2
embedding path is covered manually because it needs to download model weights
on first run, which is too heavy for CI.
"""

import os

os.environ.setdefault("SKIP_DB_INIT", "true")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault(
    "JWT_SECRET_KEY", "test-secret-key-with-enough-length-123456"
)
os.environ.setdefault("EMAIL_DEBUG_OTP", "true")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("RESEND_API_KEY", "")
os.environ.setdefault("RESEND_FROM_EMAIL", "")

from bson import ObjectId
from fastapi.testclient import TestClient

from app.dependencies import get_current_user
from app.main import app


def _override_user():
    yield {"_id": ObjectId(), "email": "walker@example.com"}


def _client() -> TestClient:
    app.dependency_overrides[get_current_user] = _override_user
    return TestClient(app)


def test_walk_analyze_rejects_unauthenticated_request() -> None:
    app.dependency_overrides.pop(get_current_user, None)
    client = TestClient(app)
    response = client.post(
        "/api/v1/walk-scan/analyze",
        json={"frames": [], "calibrationIndexes": []},
    )
    assert response.status_code == 401


def test_walk_analyze_rejects_empty_frames() -> None:
    client = _client()
    response = client.post(
        "/api/v1/walk-scan/analyze",
        json={"frames": [], "calibrationIndexes": [0]},
    )
    assert response.status_code == 422
    assert "frames" in response.json()["detail"].lower()


def test_walk_analyze_rejects_calibration_outside_frame_set() -> None:
    client = _client()
    payload = {
        "frames": [
            {
                "index": 0,
                "timestampMs": 0,
                "dataUrl": "data:image/jpeg;base64," + "A" * 64,
            }
        ],
        "calibrationIndexes": [99],
    }
    response = client.post("/api/v1/walk-scan/analyze", json=payload)
    # Either 400 from inference layer or 422 from pydantic max_length on dataUrl;
    # both indicate the request was rejected before any GPU work happened.
    assert response.status_code in (400, 422)


def test_walk_summary_returns_fallback_without_gemini() -> None:
    client = _client()
    response = client.post(
        "/api/v1/walk-scan/summary",
        json={
            "framesAnalyzed": 30,
            "validFrameCount": 25,
            "skippedFrameCount": 5,
            "calibrationFrameCount": 9,
            "anomalyMean": 0.04,
            "anomalyStdev": 0.02,
            "suspiciousWindows": [
                {"startMs": 8000, "endMs": 9500, "level": "high"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "summary" in body
    assert isinstance(body["summary"], str)
    assert len(body["summary"]) > 20
