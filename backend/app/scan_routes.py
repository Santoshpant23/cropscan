from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.collection import Collection

from app.database import get_scans_collection_dependency
from app.dependencies import get_current_user
from app.models import ScanResponse

router = APIRouter(prefix="/scans", tags=["scans"])


def serialize_scan(scan: dict) -> ScanResponse:
    serialized_scan = {
        **scan,
        "_id": str(scan["_id"]),
        "user_id": str(scan["user_id"]),
    }
    return ScanResponse.model_validate(serialized_scan)


@router.get("", response_model=list[ScanResponse], response_model_by_alias=False)
def get_scans(
    current_user: dict = Depends(get_current_user),
    scans_collection: Collection = Depends(get_scans_collection_dependency),
) -> list[ScanResponse]:
    scans = scans_collection.find({"user_id": current_user["_id"]}).sort(
        "timestamp", -1
    )
    return [serialize_scan(scan) for scan in scans]


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
