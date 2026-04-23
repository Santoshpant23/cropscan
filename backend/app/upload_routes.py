import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.ai_service import generate_chat_reply
from app.dependencies import get_current_user
from app.models import DiagnosisChatRequest, DiagnosisChatResponse

router = APIRouter(tags=["prediction"])
logger = logging.getLogger(__name__)


@router.post("/upload")
async def upload_leaf_image(
    file: UploadFile = File(...),
    _current_user: dict = Depends(get_current_user),
) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a valid image file.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image is empty.",
        )

    try:
        from app.inference import predict_leaf_image

        return predict_leaf_image(image_bytes, file.filename or "leaf-image")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        logger.exception("Inference runtime failure during upload.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected inference failure during upload.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend inference failed. Check backend logs for the root cause.",
        ) from exc


@router.post("/chat", response_model=DiagnosisChatResponse)
async def diagnosis_chat(
    payload: DiagnosisChatRequest,
    _current_user: dict = Depends(get_current_user),
) -> DiagnosisChatResponse:
    prior_user_messages = sum(1 for message in payload.messages if message.role == "user")
    if prior_user_messages >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="This scan has reached the 10-question chat limit.",
        )

    answer = generate_chat_reply(
        analysis=payload.analysis.model_dump(by_alias=True),
        messages=[message.model_dump() for message in payload.messages],
        message=payload.message,
    )
    return DiagnosisChatResponse(answer=answer)
