import base64
import hashlib
import logging
import mimetypes
import uuid
from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import get_scans_collection_dependency
from app.dependencies import get_current_user
from app.models import ScanCreate, ScanFeedback, ScanResponse, ScanUpdate
from app.rate_limit import limiter
from app.security import decode_prediction_token

router = APIRouter(prefix="/scans", tags=["scans"])
logger = logging.getLogger(__name__)


class ScanReviewedUpdate(BaseModel):
    reviewed: bool = True


def _user_id(current_user: dict) -> str:
    return str(current_user["_id"])


MAX_SCAN_THUMBNAIL_CHARS = 1_000_000


def _image_hash(image_hashes: list[str]) -> str:
    return hashlib.sha256("::".join(image_hashes).encode("utf-8")).hexdigest()


def _prediction_confidence_percent(prediction: dict) -> float:
    if "confidencePercent" in prediction:
        return round(float(prediction["confidencePercent"]), 2)
    return round(float(prediction.get("confidence") or 0) * 100, 2)


def _persisted_prediction(prediction: dict) -> dict:
    return {
        "modelName": prediction["modelName"],
        "crop": prediction["crop"],
        "disease": prediction["disease"],
        "className": prediction.get("className"),
        "confidence": _prediction_confidence_percent(prediction),
        "confidenceMargin": prediction.get("confidenceMargin"),
        "entropy": prediction.get("entropy"),
        "temperature": prediction.get("temperature"),
        "thresholds": prediction.get("thresholds"),
        "topK": [
            {
                "className": top_prediction["className"],
                "crop": top_prediction["crop"],
                "disease": top_prediction["disease"],
                "confidence": _prediction_confidence_percent(top_prediction),
            }
            for top_prediction in (prediction.get("topK") or [])[:3]
        ],
        "photoIndex": prediction.get("photoIndex"),
        "photoFileName": prediction.get("photoFileName"),
    }


def _validate_thumbnail_payload(payload: ScanCreate) -> list[str]:
    photo_data_urls = payload.photoDataUrls or [payload.imageDataUrl]
    if len(photo_data_urls) != payload.photoCount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saved thumbnails do not match the photo count.",
        )
    for data_url in photo_data_urls:
        if len(data_url) > MAX_SCAN_THUMBNAIL_CHARS:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Saved preview image is too large. Try a smaller photo.",
            )
    return photo_data_urls


def _serialize_scan(scan: dict) -> ScanResponse:
    return ScanResponse(
        id=str(scan["_id"]),
        userEmail=scan["user_email"],
        fileName=scan["file_name"],
        imageDataUrl=scan["image_data_url"],
        photoDataUrls=scan.get("photo_data_urls") or [scan["image_data_url"]],
        photoCount=int(scan.get("photo_count") or 1),
        plotId=scan.get("plot_id"),
        plotName=scan.get("plot_name"),
        scanLocationLabel=scan.get("scan_location_label"),
        cropType=scan.get("crop_type"),
        condition=scan.get("condition"),
        confidencePercent=scan.get("confidence_percent"),
        status=scan["status"],
        diagnosisState=scan.get("diagnosis_state"),
        diagnosisStateLabel=scan.get("diagnosis_state_label"),
        diagnosisReason=scan.get("diagnosis_reason"),
        recommendation=scan["recommendation"],
        recommendationDetails=scan.get("recommendation_details"),
        predictions=scan.get("predictions") or [],
        photoResults=scan.get("photo_results") or [],
        notes=scan.get("notes") or "",
        accurate=scan.get("accurate"),
        consented_for_training=bool(scan.get("consented_for_training", False)),
        image_url=scan.get("image_url"),
        reviewedAt=scan.get("reviewed_at"),
        createdAt=scan["created_at"],
        updatedAt=scan["updated_at"],
    )


def _scan_filter(scan_id: str, current_user: dict) -> dict:
    try:
        object_id = ObjectId(scan_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        ) from exc

    return {"_id": object_id, "user_id": _user_id(current_user)}


@router.get("", response_model=list[ScanResponse])
@limiter.limit("60/minute")
def list_scans(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> list[ScanResponse]:
    scans = scans_collection.find({"user_id": _user_id(current_user)}).sort(
        "created_at", -1
    )
    return [_serialize_scan(scan) for scan in scans.skip(skip).limit(limit)]


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def create_scan(
    request: Request,
    payload: ScanCreate,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    now = datetime.now(UTC)
    user_id = _user_id(current_user)
    prediction_result = decode_prediction_token(payload.predictionToken, user_id)
    image_hashes = prediction_result.get("imageHashes") or []
    if not image_hashes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scan result is missing image verification data. Run the scan again.",
        )

    photo_data_urls = _validate_thumbnail_payload(payload)
    image_hash = _image_hash(image_hashes)
    existing_scan = scans_collection.find_one(
        {"user_id": user_id, "image_hash": image_hash}
    )
    if existing_scan is not None:
        return _serialize_scan(existing_scan)

    if scans_collection.count_documents({"user_id": user_id}) >= get_settings().max_scans_per_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scan history is full. Delete older scans before saving more.",
        )

    scan_document = {
        "user_id": user_id,
        "user_email": current_user["email"],
        "image_hash": image_hash,
        "image_hashes": image_hashes,
        "file_name": prediction_result.get("fileName") or payload.fileName,
        "image_data_url": payload.imageDataUrl,
        "photo_data_urls": photo_data_urls,
        "photo_count": int(prediction_result.get("photoCount") or payload.photoCount),
        "plot_id": payload.plotId,
        "plot_name": payload.plotName,
        "scan_location_label": payload.scanLocationLabel,
        "crop_type": prediction_result.get("cropType"),
        "condition": prediction_result.get("condition"),
        "confidence_percent": prediction_result.get("confidencePercent"),
        "status": prediction_result.get("status") or "Review needed",
        "diagnosis_state": prediction_result.get("diagnosisState"),
        "diagnosis_state_label": prediction_result.get("diagnosisStateLabel"),
        "diagnosis_reason": prediction_result.get("diagnosisReason"),
        "recommendation": prediction_result.get("recommendation")
        or "Review this scan with a local expert before treating.",
        "recommendation_details": prediction_result.get("recommendationDetails"),
        "predictions": [
            _persisted_prediction(prediction)
            for prediction in (prediction_result.get("predictions") or [])
        ],
        "photo_results": prediction_result.get("photoResults") or [],
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = scans_collection.insert_one(scan_document)
    except DuplicateKeyError:
        # A concurrent request (double-tap / retry) already saved this exact
        # image for this user. The unique (user_id, image_hash) index rejects
        # the second insert; return the existing scan instead of a 500.
        existing = scans_collection.find_one(
            {"user_id": user_id, "image_hash": image_hash}
        )
        if existing is not None:
            return _serialize_scan(existing)
        raise
    saved_scan = scans_collection.find_one({"_id": result.inserted_id})

    return _serialize_scan(saved_scan)


@router.patch("/{scan_id}", response_model=ScanResponse)
@limiter.limit("60/minute")
def update_scan(
    request: Request,
    scan_id: str,
    payload: ScanUpdate,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    result = scans_collection.update_one(
        _scan_filter(scan_id, current_user),
        {
            "$set": {
                "notes": payload.notes,
                "updated_at": datetime.now(UTC),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )

    saved_scan = scans_collection.find_one(_scan_filter(scan_id, current_user))
    if saved_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )
    return _serialize_scan(saved_scan)


def _upload_misclassified_image_to_s3(scan_id: str, image_data_url: str) -> str:
    if not image_data_url or "," not in image_data_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saved scan image is not available for training upload.",
        )

    settings = get_settings()
    if (
        not settings.aws_access_key_id
        or not settings.aws_secret_access_key
        or not settings.aws_region
        or not settings.s3_bucket_name
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 training upload is not configured on this server.",
        )

    metadata, encoded_image = image_data_url.split(",", 1)
    content_type = "image/jpeg"
    if metadata.startswith("data:") and ";" in metadata:
        content_type = metadata[5 : metadata.index(";")] or content_type

    try:
        image_bytes = base64.b64decode(encoded_image, validate=True)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saved scan image could not be decoded for training upload.",
        ) from exc

    extension = mimetypes.guess_extension(content_type) or ".jpg"
    object_key = f"misclassified/{scan_id}-{uuid.uuid4().hex}{extension}"

    try:
        import boto3
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 upload dependency boto3 is not installed.",
        ) from exc

    try:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        s3_client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=object_key,
            Body=image_bytes,
            ContentType=content_type,
        )
    except Exception as exc:
        logger.exception("Could not upload scan image %s to S3.", scan_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload the scan image for training.",
        ) from exc

    return (
        f"https://{settings.s3_bucket_name}.s3."
        f"{settings.aws_region}.amazonaws.com/{object_key}"
    )


@router.patch("/{scan_id}/feedback", response_model=ScanResponse)
@limiter.limit("30/minute")
def submit_scan_feedback(
    request: Request,
    scan_id: str,
    payload: ScanFeedback,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    scan_filter = _scan_filter(scan_id, current_user)
    scan = scans_collection.find_one(scan_filter)
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )

    if payload.accurate and payload.consented_for_training:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Training consent is only used for inaccurate diagnoses.",
        )

    updates: dict = {
        "accurate": payload.accurate,
        "consented_for_training": payload.consented_for_training,
        "updated_at": datetime.now(UTC),
    }
    if payload.consented_for_training:
        # Idempotent: if this scan already has an uploaded training image,
        # reuse the existing S3 object instead of allocating a new UUID key.
        # Prevents both orphan-leak on resubmit AND races where two parallel
        # PATCHes would each upload a fresh copy.
        existing_image_url = scan.get("image_url")
        if existing_image_url:
            updates["image_url"] = existing_image_url
        else:
            updates["image_url"] = _upload_misclassified_image_to_s3(
                scan_id,
                scan.get("image_data_url") or "",
            )

    scans_collection.update_one(scan_filter, {"$set": updates})
    saved_scan = scans_collection.find_one(scan_filter)
    if saved_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )
    return _serialize_scan(saved_scan)


@router.patch("/{scan_id}/reviewed", response_model=ScanResponse)
@limiter.limit("60/minute")
def mark_scan_reviewed(
    request: Request,
    scan_id: str,
    payload: ScanReviewedUpdate,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    scan_filter = _scan_filter(scan_id, current_user)
    now = datetime.now(UTC)
    updates: dict = {"updated_at": now}
    if payload.reviewed:
        updates["reviewed_at"] = now
    else:
        updates["reviewed_at"] = None
    result = scans_collection.update_one(scan_filter, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )
    saved_scan = scans_collection.find_one(scan_filter)
    if saved_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )
    return _serialize_scan(saved_scan)


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def delete_scan(
    request: Request,
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> None:
    result = scans_collection.delete_one(_scan_filter(scan_id, current_user))
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record was not found.",
        )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def clear_scans(
    request: Request,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> None:
    scans_collection.delete_many({"user_id": _user_id(current_user)})
