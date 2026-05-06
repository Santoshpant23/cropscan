from datetime import UTC, datetime
import hashlib

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo.collection import Collection

from app.config import get_settings
from app.database import get_scans_collection_dependency
from app.dependencies import get_current_user
from app.models import ScanCreate, ScanResponse, ScanUpdate
from app.rate_limit import limiter
from app.security import decode_prediction_token

router = APIRouter(prefix="/scans", tags=["scans"])


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
        "status": prediction_result["status"],
        "diagnosis_state": prediction_result.get("diagnosisState"),
        "diagnosis_state_label": prediction_result.get("diagnosisStateLabel"),
        "diagnosis_reason": prediction_result.get("diagnosisReason"),
        "recommendation": prediction_result["recommendation"],
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

    result = scans_collection.insert_one(scan_document)
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
