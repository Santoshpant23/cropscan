import base64
import logging
import mimetypes
import uuid
from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import get_scans_collection_dependency
from app.dependencies import get_current_user
from app.models import ScanCreate, ScanFeedback, ScanResponse, ScanUpdate
from app.security import decode_prediction_token

router = APIRouter(prefix="/scans", tags=["scans"])
logger = logging.getLogger(__name__)


def serialize_scan(scan: dict) -> ScanResponse:
    serialized_scan = {
        **scan,
        "id": str(scan["_id"]),
        "userEmail": scan.get("user_email") or scan.get("userEmail") or "",
        "fileName": scan.get("fileName") or scan.get("image_filename") or "leaf-image",
        "imageDataUrl": scan.get("imageDataUrl") or "",
        "photoDataUrls": scan.get("photoDataUrls") or [],
        "photoCount": scan.get("photoCount") or 1,
        "cropType": scan.get("cropType") or scan.get("crop_type"),
        "condition": scan.get("condition") or scan.get("disease_label"),
        "confidencePercent": scan.get("confidencePercent")
        or scan.get("confidence_percent"),
        "recommendationDetails": scan.get("recommendationDetails")
        or scan.get("recommendation_details"),
        "reviewedAt": scan.get("reviewed_at") or scan.get("reviewedAt"),
        "accurate": scan.get("accurate"),
        "consented_for_training": scan.get("consented_for_training", False),
        "image_url": scan.get("image_url"),
        "createdAt": (
            scan.get("created_at") or scan.get("createdAt") or scan.get("timestamp")
        ),
        "updatedAt": (
            scan.get("updated_at") or scan.get("updatedAt") or scan.get("timestamp")
        ),
    }
    return ScanResponse.model_validate(serialized_scan)


@router.post(
    "",
    response_model=ScanResponse,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
def create_scan(
    payload: ScanCreate,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    prediction_result = decode_prediction_token(
        payload.predictionToken,
        str(current_user["_id"]),
    )
    now = datetime.now(UTC)
    image_hashes = prediction_result.get("imageHashes") or []
    first_image_hash = image_hashes[0] if image_hashes else None
    scan_document = {
        "user_id": current_user["_id"],
        "user_email": current_user["email"],
        "prediction_token": payload.predictionToken,
        "fileName": payload.fileName,
        "imageDataUrl": payload.imageDataUrl,
        "photoDataUrls": payload.photoDataUrls or [payload.imageDataUrl],
        "photoCount": payload.photoCount,
        "plotId": payload.plotId,
        "plotName": payload.plotName,
        "scanLocationLabel": payload.scanLocationLabel,
        "cropType": prediction_result.get("cropType"),
        "condition": prediction_result.get("condition"),
        "rawDiseaseLabel": prediction_result.get("rawDiseaseLabel"),
        "diseaseFriendlyName": prediction_result.get("diseaseFriendlyName"),
        "diseaseExplanation": prediction_result.get("diseaseExplanation"),
        "confidencePercent": prediction_result.get("confidencePercent"),
        "status": prediction_result.get("status") or "Review needed",
        "diagnosisState": prediction_result.get("diagnosisState"),
        "diagnosisStateLabel": prediction_result.get("diagnosisStateLabel"),
        "diagnosisReason": prediction_result.get("diagnosisReason"),
        "recommendation": prediction_result.get("recommendation") or "",
        "recommendationDetails": prediction_result.get("recommendationDetails"),
        "predictions": prediction_result.get("predictions") or [],
        "photoResults": prediction_result.get("photoResults") or [],
        "image_hash": first_image_hash,
        "image_hashes": image_hashes,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = scans_collection.insert_one(scan_document)
    except DuplicateKeyError as exc:
        if first_image_hash:
            existing_scan = scans_collection.find_one(
                {"user_id": current_user["_id"], "image_hash": first_image_hash}
            )
            if existing_scan is not None:
                return serialize_scan(existing_scan)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This scan has already been saved.",
        ) from exc

    saved_scan = scans_collection.find_one({"_id": result.inserted_id})
    return serialize_scan(saved_scan)


@router.get("", response_model=list[ScanResponse], response_model_by_alias=False)
def get_scans(
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> list[ScanResponse]:
    scans = scans_collection.find({"user_id": current_user["_id"]}).sort(
        "created_at", -1
    )
    return [serialize_scan(scan) for scan in scans]


@router.patch("/{scan_id}", response_model=ScanResponse, response_model_by_alias=False)
def update_scan(
    scan_id: str,
    payload: ScanUpdate,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    if not ObjectId.is_valid(scan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one scan field to update.",
        )

    if "notes" in updates:
        updates["notes"] = updates["notes"].strip()
    if updates.pop("reviewed", False):
        updates["reviewed_at"] = datetime.now(UTC)
    updates["updated_at"] = datetime.now(UTC)

    result = scans_collection.update_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    saved_scan = scans_collection.find_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]}
    )
    if saved_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )
    return serialize_scan(saved_scan)


def upload_misclassified_image_to_s3(scan_id: str, image_data_url: str) -> str:
    if "," not in image_data_url:
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 training upload is not configured.",
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    except Exception as exc:  # pragma: no cover - depends on AWS availability
        logger.exception("Could not upload scan image %s to S3.", scan_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload the scan image for training.",
        ) from exc

    return (
        f"https://{settings.s3_bucket_name}.s3."
        f"{settings.aws_region}.amazonaws.com/{object_key}"
    )


@router.patch(
    "/{scan_id}/feedback",
    response_model=ScanResponse,
    response_model_by_alias=False,
)
def submit_scan_feedback(
    scan_id: str,
    payload: ScanFeedback,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> ScanResponse:
    if not ObjectId.is_valid(scan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    scan = scans_collection.find_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]}
    )
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    updates = {
        "accurate": payload.accurate,
        "consented_for_training": payload.consented_for_training,
        "updated_at": datetime.now(UTC),
    }
    if payload.consented_for_training:
        if payload.accurate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Training consent is only used for inaccurate diagnoses.",
            )
        updates["image_url"] = upload_misclassified_image_to_s3(
            scan_id,
            scan.get("imageDataUrl") or "",
        )

    scans_collection.update_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]},
        {"$set": updates},
    )
    saved_scan = scans_collection.find_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]}
    )
    if saved_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )
    return serialize_scan(saved_scan)


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> None:
    if not ObjectId.is_valid(scan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    result = scans_collection.delete_one(
        {"_id": ObjectId(scan_id), "user_id": current_user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )
