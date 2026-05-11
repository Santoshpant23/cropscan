import asyncio
import logging
import hashlib
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.ai_service import generate_chat_reply
from app.dependencies import get_current_user
from app.models import DiagnosisChatRequest, DiagnosisChatResponse
from app.rate_limit import limiter
from app.security import create_prediction_token

router = APIRouter(tags=["prediction"])
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_TOTAL_UPLOAD_BYTES = 16 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def _validate_image_bytes(image_bytes: bytes, content_type: str | None) -> None:
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a JPEG, PNG, or WEBP leaf image.",
        )

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.format != ALLOWED_IMAGE_TYPES[content_type]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image content does not match the uploaded file type.",
                )
            image.load()
    except HTTPException:
        raise
    except Image.DecompressionBombError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image dimensions are too large. Upload a smaller leaf image.",
        ) from exc
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a valid JPEG, PNG, or WEBP image.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a readable JPEG, PNG, or WEBP image.",
        ) from exc


@router.post("/upload")
@limiter.limit("30/minute")
async def upload_leaf_image(
    request: Request,
    files: list[UploadFile] | None = File(default=None),
    file: UploadFile | None = File(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    upload_files = files or ([file] if file is not None else [])
    if not upload_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload at least one JPEG, PNG, or WEBP leaf image.",
        )
    if len(upload_files) > 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload at most three leaf images for one diagnosis.",
        )

    image_payloads = []
    image_hashes = []
    total_bytes = 0
    for upload_file in upload_files:
        image_bytes = await upload_file.read(MAX_UPLOAD_BYTES + 1)
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded image is empty.",
            )
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image upload is too large. Maximum file size is 8 MB.",
            )
        total_bytes += len(image_bytes)
        if total_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Upload one to three photos totaling 16 MB or less.",
            )

        _validate_image_bytes(image_bytes, upload_file.content_type)
        image_hashes.append(hashlib.sha256(image_bytes).hexdigest())
        image_payloads.append((image_bytes, upload_file.filename or "leaf-image"))

    try:
        from app.inference import predict_leaf_images

        result = await asyncio.to_thread(predict_leaf_images, image_payloads)
        result["imageHashes"] = image_hashes
        result["predictionToken"] = create_prediction_token(
            str(current_user["_id"]),
            result,
        )
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        logger.exception("Inference model file is missing.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend model files are missing. Check backend logs.",
        ) from exc
    except RuntimeError as exc:
        logger.exception("Inference runtime failure during upload.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend inference failed while loading or running the model. Check backend logs.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected inference failure during upload.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend inference failed. Check backend logs for the root cause.",
        ) from exc

@router.post("/chat", response_model=DiagnosisChatResponse)
@limiter.limit("30/minute")
async def diagnosis_chat(
    request: Request,
    payload: DiagnosisChatRequest,
    _current_user: dict = Depends(get_current_user),
) -> DiagnosisChatResponse:
    prior_user_messages = sum(1 for message in payload.messages if message.role == "user")
    if prior_user_messages >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="This scan has reached the 10-question chat limit.",
        )

    answer = await asyncio.to_thread(
        generate_chat_reply,
        analysis=payload.analysis.model_dump(by_alias=True),
        messages=[message.model_dump() for message in payload.messages],
        message=payload.message,
    )
    return DiagnosisChatResponse(answer=answer)
