"""Walk Scan inference: anomaly detection over a video walk-through.

Pipeline per request:

    sampled frames (already extracted client-side as JPEG data URLs)
        -> per-frame quality check (green-pixel ratio + Laplacian blur)
        -> DINOv2-small CLS embedding for frames that pass the gate
        -> mean of the user-marked calibration embeddings = "healthy reference"
        -> per-frame anomaly score = 1 - cos(frame_emb, reference_emb)
        -> level bucket (low / medium / high) by mean + stdev of valid scores

We use DINOv2 (frozen, no fine-tune) because PlantVillage-trained classifiers
hallucinate disease classes on field-walk frames. Anomaly detection on a
foundation embedding is robust to crops we never trained on and produces an
honest "this region looks different from healthy" signal instead of a
confidently-wrong disease name.

The model itself is loaded lazily on the first request and cached for the
process lifetime via ``functools.lru_cache``.
"""

from __future__ import annotations

import base64
import logging
import math
import time
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO

import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from torchvision import transforms

from app.config import get_settings
from app.inference import predict_leaf_image

logger = logging.getLogger(__name__)

# Frame quality gates. Tuned to be permissive: we skip clearly-not-plant or
# clearly-blurred frames, but otherwise let the embedding decide.
GREEN_RATIO_MIN = 0.05
BLUR_VARIANCE_MIN = 60.0
YOLO_LEAF_CONFIDENCE_MIN = 0.18
YOLO_LEAF_FALLBACK_GREEN_RATIO_MIN = 0.16

YOLO_LEAF_KEYWORDS = (
    "leaf",
    "leaves",
    "plant",
    "crop",
    "tree",
    "flower",
    "potted plant",
)

# DINOv2 input. The native checkpoint trains at 518x518; we downsample to 224
# for CPU speed. timm handles position-embedding interpolation automatically.
WALK_INPUT_SIZE = 224

# Anomaly score levels are computed relative to the mean and stdev of valid
# (non-calibration, non-skipped) scores. Coefficients chosen so that with no
# real anomalies present (small stdev) almost everything stays "low".
LEVEL_MEDIUM_COEF = 0.5
LEVEL_HIGH_COEF = 1.5

# Bounds on per-request payload. Enforced again at the route layer; defined
# here so the inference function can fail fast.
MAX_FRAMES = 90
MAX_FRAME_BYTES = 250_000

# Cap the per-request cost of the per-frame disease classifier. The v5
# DINOv2-LoRA + EfficientNetV2-S ensemble is several seconds per call on
# CPU; running it on every medium/high frame can stretch a Walk Scan
# response past the route timeout. We classify the top-K suspicious frames
# by anomaly score and leave the rest as anomaly-only signals.
MAX_PER_FRAME_DISEASE_CALLS = 6


class WalkInferenceError(ValueError):
    """Raised when a request cannot be processed (bad input, no calibration)."""


@dataclass(frozen=True)
class FrameQuality:
    green_ratio: float
    blur_score: float
    status: str  # "ok" | "low_plant_signal" | "too_blurry" | "no_leaf_detected" | "decode_failed" | "analysis_failed"
    leaf_detected: bool = False
    leaf_confidence: float | None = None
    leaf_label: str | None = None


@dataclass(frozen=True)
class FrameResult:
    index: int
    timestamp_ms: int
    captured_at: str | None
    status: str  # "calibration" | "ok" | "low_plant_signal" | "too_blurry" | "no_leaf_detected" | "decode_failed" | "analysis_failed"
    anomaly_score: float | None
    level: str | None  # "low" | "medium" | "high" | None
    green_ratio: float
    blur_score: float
    leaf_detected: bool = False
    leaf_confidence: float | None = None
    leaf_label: str | None = None
    disease_name: str | None = None
    disease_confidence: float | None = None
    disease_confidence_percent: float | None = None


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------


def warmup_walk_model() -> dict:
    """Force-load the DINOv2 bundle so the next analyze call does not pay the
    weight-download / first-init cost. Returns timing info for the caller.
    """

    started_at = time.perf_counter()
    cold_start = _walk_bundle.cache_info().currsize == 0
    _walk_bundle()
    if get_settings().walk_leaf_yolo_enabled:
        try:
            _leaf_yolo_model()
        except Exception:
            logger.exception("Walk Scan YOLO warmup failed.")
    return {
        "ready": True,
        "coldStart": cold_start,
        "durationSeconds": round(time.perf_counter() - started_at, 3),
    }


@lru_cache
def _walk_bundle() -> dict:
    """Load DINOv2-small once per process. Heavy; deferred to first request."""

    try:
        import timm
    except ImportError as exc:  # pragma: no cover - exercised at runtime only
        raise RuntimeError(
            "timm is required for Walk Scan. Install it with `pip install timm`."
        ) from exc

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = timm.create_model(
        "vit_small_patch14_dinov2.lvd142m",
        pretrained=True,
        num_classes=0,  # drop the classification head; keep CLS embedding
        img_size=WALK_INPUT_SIZE,
    )
    model.to(device)
    model.eval()

    # ImageNet normalization. DINOv2 was trained with the same mean/std.
    transform = transforms.Compose(
        [
            transforms.Resize(
                WALK_INPUT_SIZE, interpolation=transforms.InterpolationMode.BICUBIC
            ),
            transforms.CenterCrop(WALK_INPUT_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )

    return {"model": model, "device": device, "transform": transform}


@lru_cache
def _leaf_yolo_model():
    """Load a YOLO model for leaf/plant gating before DINO scoring.

    Opt-in via WALK_LEAF_YOLO_ENABLED. Set WALK_LEAF_YOLO_MODEL to a custom
    leaf-trained ultralytics weight file when available. Generic COCO YOLO
    weights do not include a true leaf class, so the quality gate below keeps
    a green-signal fallback for close-up leaves.
    """

    try:
        from ultralytics import YOLO
    except ImportError as exc:  # pragma: no cover - exercised at runtime only
        raise RuntimeError(
            "ultralytics is required for Walk Scan leaf filtering. "
            "Install it with `pip install ultralytics`."
        ) from exc

    model_path = get_settings().walk_leaf_yolo_model or "yolo11n.pt"
    return YOLO(model_path)


# ---------------------------------------------------------------------------
# Frame decoding + quality gate
# ---------------------------------------------------------------------------


def _decode_data_url(data_url: str) -> bytes:
    if not data_url.startswith("data:image/"):
        raise WalkInferenceError("Frame is not an image data URL.")
    try:
        _, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise WalkInferenceError("Frame data URL is malformed.") from exc
    try:
        decoded = base64.b64decode(encoded, validate=False)
    except (ValueError, TypeError) as exc:
        raise WalkInferenceError("Frame is not valid base64.") from exc
    if len(decoded) > MAX_FRAME_BYTES:
        raise WalkInferenceError(
            f"Frame is too large; keep each frame under {MAX_FRAME_BYTES} bytes."
        )
    return decoded


def _green_ratio(image: Image.Image) -> float:
    pixels = np.asarray(image.resize((128, 128)), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    mask = (green > 60) & (green > red * 1.12) & (green > blue * 1.08)
    return float(mask.mean())


def _blur_score(image: Image.Image) -> float:
    """Laplacian variance. Higher = sharper."""

    grayscale = np.asarray(image.convert("L").resize((128, 128)), dtype=np.float32)
    # 3x3 Laplacian kernel evaluated via slicing rather than scipy/cv2 so we
    # don't add another runtime dependency.
    center = grayscale[1:-1, 1:-1]
    laplacian = (
        grayscale[:-2, 1:-1]
        + grayscale[2:, 1:-1]
        + grayscale[1:-1, :-2]
        + grayscale[1:-1, 2:]
        - 4 * center
    )
    return float(laplacian.var())


def _quality_gate(image: Image.Image) -> FrameQuality:
    green = _green_ratio(image)
    blur = _blur_score(image)
    if green < GREEN_RATIO_MIN:
        status = "low_plant_signal"
    elif blur < BLUR_VARIANCE_MIN:
        status = "too_blurry"
    else:
        status = "ok"
    return FrameQuality(green_ratio=green, blur_score=blur, status=status)


def _detect_leaf_with_yolo(
    image: Image.Image,
) -> tuple[bool, float | None, str | None]:
    try:
        model = _leaf_yolo_model()
    except Exception:
        logger.exception("Walk Scan YOLO model could not be loaded.")
        return False, None, None
    try:
        results = model.predict(
            source=image,
            imgsz=320,
            conf=YOLO_LEAF_CONFIDENCE_MIN,
            verbose=False,
        )
    except Exception:
        logger.exception("Walk Scan YOLO prediction failed.")
        return False, None, None

    best_confidence: float | None = None
    best_label: str | None = None

    for result in results:
        names = getattr(result, "names", None) or {}
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue
        for box in boxes:
            try:
                class_id = int(box.cls[0])
                label = str(names.get(class_id, class_id))
                confidence = float(box.conf[0])
            except (IndexError, TypeError, ValueError):
                continue
            if best_confidence is None or confidence > best_confidence:
                best_confidence = confidence
                best_label = label
            if any(keyword in label.lower() for keyword in YOLO_LEAF_KEYWORDS):
                return True, confidence, label

    return False, best_confidence, best_label


def _apply_leaf_gate(image: Image.Image, quality: FrameQuality) -> FrameQuality:
    if quality.status != "ok":
        return quality
    if not get_settings().walk_leaf_yolo_enabled:
        return quality

    leaf_detected, leaf_confidence, leaf_label = _detect_leaf_with_yolo(image)
    if leaf_detected:
        return FrameQuality(
            green_ratio=quality.green_ratio,
            blur_score=quality.blur_score,
            status="ok",
            leaf_detected=True,
            leaf_confidence=leaf_confidence,
            leaf_label=leaf_label,
        )
    if quality.green_ratio >= YOLO_LEAF_FALLBACK_GREEN_RATIO_MIN:
        # Fallback admit on green signal; don't claim a YOLO leaf match here.
        # The non-matching best-box label/confidence would be misleading.
        return FrameQuality(
            green_ratio=quality.green_ratio,
            blur_score=quality.blur_score,
            status="ok",
            leaf_detected=False,
            leaf_confidence=None,
            leaf_label=None,
        )

    return FrameQuality(
        green_ratio=quality.green_ratio,
        blur_score=quality.blur_score,
        status="no_leaf_detected",
        leaf_detected=False,
        leaf_confidence=leaf_confidence,
        leaf_label=leaf_label,
    )


def _decode_frame(data_url: str) -> tuple[Image.Image | None, FrameQuality]:
    try:
        raw = _decode_data_url(data_url)
        image = Image.open(BytesIO(raw)).convert("RGB")
        image.load()
    except (UnidentifiedImageError, OSError, WalkInferenceError):
        return None, FrameQuality(green_ratio=0.0, blur_score=0.0, status="decode_failed")
    quality = _quality_gate(image)
    quality = _apply_leaf_gate(image, quality)
    return image, quality


def _diagnose_frame(raw_bytes: bytes, frame_index: int) -> dict:
    try:
        return predict_leaf_image(
            raw_bytes,
            f"walk-frame-{frame_index}.jpg",
            include_recommendation=False,
        )
    except Exception:
        logger.exception(
            "Walk Scan per-frame disease detection failed for frame %s.",
            frame_index,
        )
        return {}


# ---------------------------------------------------------------------------
# Embedding + anomaly scoring
# ---------------------------------------------------------------------------


def _embed_batch(images: list[Image.Image]) -> np.ndarray:
    """Return L2-normalized DINOv2 CLS embeddings, shape (N, D)."""

    bundle = _walk_bundle()
    transform = bundle["transform"]
    device = bundle["device"]
    model = bundle["model"]

    tensors = torch.stack([transform(image) for image in images]).to(device)
    with torch.no_grad():
        features = model(tensors)
    features_np = features.detach().cpu().numpy().astype(np.float32)
    norms = np.linalg.norm(features_np, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return features_np / norms


def _level_for(score: float, mean: float, stdev: float) -> str:
    if stdev < 1e-6:
        return "low"
    if score >= mean + LEVEL_HIGH_COEF * stdev:
        return "high"
    if score >= mean + LEVEL_MEDIUM_COEF * stdev:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def analyze_walk(
    frames: list[dict],
    calibration_indexes: list[int],
) -> dict:
    """Run the full Walk Scan pipeline. ``frames`` items are dicts with keys
    ``index``, ``timestampMs``, ``dataUrl``. ``calibration_indexes`` are the
    indices the user marked as "this is healthy" (typically the first 3 sec).

    Raises ``WalkInferenceError`` for bad inputs. Other errors propagate so
    the route layer can return 500 with logs.
    """

    if not frames:
        raise WalkInferenceError("Send at least one frame.")
    if len(frames) > MAX_FRAMES:
        raise WalkInferenceError(
            f"Send at most {MAX_FRAMES} frames in a single Walk Scan."
        )

    indexes_seen: set[int] = set()
    for frame in frames:
        index = int(frame["index"])
        if index in indexes_seen:
            raise WalkInferenceError("Frame indexes must be unique.")
        indexes_seen.add(index)

    calibration_set = {int(i) for i in calibration_indexes}
    if not calibration_set:
        raise WalkInferenceError(
            "Mark at least one calibration frame so we know what healthy looks like."
        )
    if not calibration_set.issubset(indexes_seen):
        raise WalkInferenceError(
            "Calibration indexes must reference frames included in the request."
        )

    # Decode + quality gate, in order. Keep decoded images only for frames
    # that pass the gate so we can run a single batched embedding pass.
    # Also cache raw bytes for the per-frame disease classifier below so
    # we don't re-decode base64 + PIL on every medium/high anomaly frame.
    decoded: list[tuple[dict, Image.Image | None, FrameQuality]] = []
    raw_bytes_by_position: dict[int, bytes] = {}
    for position, frame in enumerate(frames):
        image: Image.Image | None = None
        quality: FrameQuality
        try:
            raw = _decode_data_url(frame["dataUrl"])
            try:
                image = Image.open(BytesIO(raw)).convert("RGB")
                image.load()
                quality = _quality_gate(image)
                quality = _apply_leaf_gate(image, quality)
                raw_bytes_by_position[position] = raw
            except (UnidentifiedImageError, OSError):
                image = None
                quality = FrameQuality(
                    green_ratio=0.0,
                    blur_score=0.0,
                    status="decode_failed",
                )
        except WalkInferenceError:
            quality = FrameQuality(
                green_ratio=0.0,
                blur_score=0.0,
                status="decode_failed",
            )
        except Exception:
            logger.exception(
                "Walk Scan frame analysis failed for frame %s.",
                frame.get("index"),
            )
            quality = FrameQuality(
                green_ratio=0.0,
                blur_score=0.0,
                status="analysis_failed",
            )
        decoded.append((frame, image, quality))

    embeddable_positions: list[int] = []
    embeddable_images: list[Image.Image] = []
    for position, (_frame, image, quality) in enumerate(decoded):
        if image is not None and quality.status == "ok":
            embeddable_positions.append(position)
            embeddable_images.append(image)

    embeddings: np.ndarray | None = None
    if embeddable_images:
        embeddings = _embed_batch(embeddable_images)

    # Pull calibration embeddings out of the embedded set.
    calibration_embeddings: list[np.ndarray] = []
    for position, frame_data in zip(embeddable_positions, embeddings if embeddings is not None else []):
        frame_index = int(decoded[position][0]["index"])
        if frame_index in calibration_set:
            calibration_embeddings.append(frame_data)

    if not calibration_embeddings:
        raise WalkInferenceError(
            "None of the calibration frames had enough plant signal. "
            "Retake the walk and start by pointing the camera at a healthy section."
        )

    reference = np.mean(np.stack(calibration_embeddings, axis=0), axis=0)
    reference_norm = np.linalg.norm(reference)
    if reference_norm == 0:
        raise WalkInferenceError("Calibration embeddings collapsed to zero.")
    reference = reference / reference_norm

    # Score every embeddable frame, including calibration frames (so the
    # frontend can show "your healthy baseline scored 0.02 on average").
    scores_by_position: dict[int, float] = {}
    if embeddings is not None:
        for position, embedding in zip(embeddable_positions, embeddings):
            similarity = float(np.dot(embedding, reference))
            score = max(0.0, min(1.0, 1.0 - similarity))
            scores_by_position[position] = score

    valid_walking_scores = [
        scores_by_position[position]
        for position in embeddable_positions
        if int(decoded[position][0]["index"]) not in calibration_set
    ]

    if valid_walking_scores:
        mean_score = float(np.mean(valid_walking_scores))
        stdev_score = float(np.std(valid_walking_scores))
    else:
        mean_score = 0.0
        stdev_score = 0.0

    # Pass 1: assign status / level for every frame so we can pick the top-K
    # suspicious frames to actually run the disease classifier on.
    interim_results: list[tuple[dict, FrameQuality, str, str | None, float | None]] = []
    for position, (frame, _image, quality) in enumerate(decoded):
        frame_index = int(frame["index"])
        is_calibration = frame_index in calibration_set
        score = scores_by_position.get(position)

        if quality.status != "ok":
            interim_status = quality.status
            interim_level = None
        elif is_calibration:
            interim_status = "calibration"
            interim_level = "low"
        else:
            interim_status = "ok"
            interim_level = _level_for(score or 0.0, mean_score, stdev_score)
        interim_results.append((frame, quality, interim_status, interim_level, score))

    # Pick the most-suspicious frames to classify, capped so a single Walk
    # Scan can't accumulate dozens of expensive ensemble inferences.
    diagnoseable_positions = [
        (position, interim_results[position][4] or 0.0)
        for position in range(len(interim_results))
        if interim_results[position][2] == "ok"
        and interim_results[position][3] in ("medium", "high")
        and position in raw_bytes_by_position
    ]
    diagnoseable_positions.sort(key=lambda item: item[1], reverse=True)
    selected_for_diagnosis = {
        position for position, _ in diagnoseable_positions[:MAX_PER_FRAME_DISEASE_CALLS]
    }

    frame_results: list[FrameResult] = []
    for position, (frame, quality, frame_status, frame_level, score) in enumerate(
        interim_results
    ):
        frame_index = int(frame["index"])
        timestamp_ms = int(frame["timestampMs"])
        captured_at = frame.get("capturedAt")

        disease_name: str | None = None
        disease_confidence: float | None = None
        disease_confidence_percent: float | None = None
        if position in selected_for_diagnosis:
            diagnosis = _diagnose_frame(
                raw_bytes_by_position.pop(position), frame_index
            )
            # Skip out-of-scope diagnoses — predict_leaf_image returns a
            # placeholder "Not a clear crop leaf" condition with confidence 0
            # which would otherwise leak into the suspicious-frames UI.
            if diagnosis.get("diagnosisState") != "out_of_scope":
                disease_name = diagnosis.get("condition")
                confidence_score = diagnosis.get("confidenceScore")
                confidence_percent = diagnosis.get("confidencePercent")
                disease_confidence = (
                    round(float(confidence_score), 4)
                    if confidence_score is not None
                    else None
                )
                disease_confidence_percent = (
                    round(float(confidence_percent), 2)
                    if confidence_percent is not None
                    else None
                )

        frame_results.append(
            FrameResult(
                index=frame_index,
                timestamp_ms=timestamp_ms,
                captured_at=str(captured_at) if captured_at else None,
                status=frame_status,
                anomaly_score=(
                    round(score, 4) if score is not None and not math.isnan(score) else None
                ),
                level=frame_level,
                green_ratio=round(quality.green_ratio, 4),
                blur_score=round(quality.blur_score, 2),
                leaf_detected=quality.leaf_detected,
                leaf_confidence=(
                    round(quality.leaf_confidence, 4)
                    if quality.leaf_confidence is not None
                    else None
                ),
                leaf_label=quality.leaf_label,
                disease_name=disease_name,
                disease_confidence=disease_confidence,
                disease_confidence_percent=disease_confidence_percent,
            )
        )

    suspicious_indexes = [
        result.index for result in frame_results if result.level in ("medium", "high")
    ]

    skipped_count = sum(
        1
        for result in frame_results
        if result.status
        in (
            "low_plant_signal",
            "too_blurry",
            "decode_failed",
            "no_leaf_detected",
            "analysis_failed",
        )
    )
    valid_count = sum(1 for result in frame_results if result.status == "ok")
    calibration_used = sum(
        1 for result in frame_results if result.status == "calibration"
    )

    return {
        "framesAnalyzed": len(frame_results),
        "validFrameCount": valid_count,
        "skippedFrameCount": skipped_count,
        "calibrationFrameCount": calibration_used,
        "anomalyMean": round(mean_score, 4),
        "anomalyStdev": round(stdev_score, 4),
        "frames": [
            {
                "index": result.index,
                "timestampMs": result.timestamp_ms,
                "capturedAt": result.captured_at,
                "status": result.status,
                "anomalyScore": result.anomaly_score,
                "level": result.level,
                "greenRatio": result.green_ratio,
                "blurScore": result.blur_score,
                "leafDetected": result.leaf_detected,
                "leafConfidence": result.leaf_confidence,
                "leafLabel": result.leaf_label,
                "diseaseName": result.disease_name,
                "diseaseConfidence": result.disease_confidence,
                "diseaseConfidencePercent": result.disease_confidence_percent,
            }
            for result in frame_results
        ],
        "suspiciousIndexes": suspicious_indexes,
    }
