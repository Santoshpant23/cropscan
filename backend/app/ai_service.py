import json
import logging
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

RECOMMENDATION_SYSTEM_PROMPT = """
You are CropScan's agricultural guidance assistant.

You receive a crop disease prediction from an image classifier. Produce practical,
cautious grower guidance in plain English. Do not claim certainty beyond the
provided diagnosis status. Do not invent product brands, prices, or affiliate claims.
If product suggestions are useful, mention only generic product categories.

Write one compact paragraph, usually 70 to 120 words, that explains what the issue is,
how urgent it is, and the first actions the grower should take.
""".strip()

CHAT_SYSTEM_PROMPT = """
You are CropScan's follow-up assistant. Answer questions about the uploaded plant
diagnosis in clear, plain English. Use the provided diagnosis context and recent chat.
Be cautious when the diagnosis status is "Review needed". Mention only generic product
categories, not brands, prices, links, or affiliate claims. Keep answers practical and
concise, usually under 180 words.
""".strip()


def _trim_text(value: str, fallback: str, max_length: int) -> str:
    cleaned = " ".join(value.split()).strip()
    if not cleaned:
        cleaned = fallback
    return cleaned[:max_length]


def _urgency_for(disease: str, status: str) -> str:
    if status == "Review needed":
        return "medium"

    lowered = disease.lower()
    if disease == "Healthy":
        return "low"
    if any(keyword in lowered for keyword in ["virus", "late blight", "greening"]):
        return "high"
    return "medium"


def _product_categories_for(disease: str, status: str) -> list[str]:
    if status == "Review needed":
        return []

    lowered = disease.lower()
    if disease == "Healthy":
        return ["clean pruning shears", "mulch", "balanced fertilizer"]
    if "mite" in lowered:
        return ["insecticidal soap", "miticide", "hand lens"]
    if "virus" in lowered or "greening" in lowered:
        return ["disinfectant for tools", "sticky traps", "insect vector control products"]
    if any(keyword in lowered for keyword in ["rust", "spot", "blight", "mildew", "rot", "mold", "scab"]):
        return ["labeled fungicide", "clean pruning shears", "sprayer"]
    return ["clean pruning shears", "protective gloves", "sprayer"]


def _fallback_details(
    *,
    crop: str,
    disease: str,
    status: str,
    confidence_percent: float,
    fallback_recommendation: str,
) -> dict:
    if status == "Review needed":
        return {
            "headline": "Diagnosis needs review",
            "urgency": "medium",
            "overview": (
                "The models did not agree strongly enough to give a reliable diagnosis. "
                "Use this scan as a hint, not as a final answer."
            ),
            "immediateSteps": [
                "Take a new close-up photo of one leaf in bright, even lighting.",
                "Capture both the front and back of the leaf if symptoms are visible.",
                "Keep watching nearby leaves for similar changes before treating broadly.",
            ],
            "productCategories": [],
            "cautions": [
                "Avoid spraying treatments based only on a low-confidence scan.",
                "A poor photo or mixed background can lower reliability.",
            ],
            "followUp": (
                "Retry with a clearer image or confirm the issue with a local extension office."
            ),
        }

    return {
        "headline": f"{crop}: {disease}",
        "urgency": _urgency_for(disease, status),
        "overview": _trim_text(
            fallback_recommendation,
            "Monitor the plant closely and respond early if symptoms spread.",
            600,
        ),
        "immediateSteps": [
            f"Inspect additional {crop.lower()} leaves for similar symptoms.",
            "Remove badly affected tissue if local guidance supports doing so.",
            "Improve airflow and reduce leaf wetness where possible.",
        ],
        "productCategories": _product_categories_for(disease, status),
        "cautions": [
            "Use only products labeled for this crop and issue in your area.",
            "Confirm local guidance before broad treatment if symptoms spread quickly.",
        ],
        "followUp": (
            f"Recheck the plant over the next few days and escalate to local expert support if {disease.lower()} appears to be spreading."
        ),
    }


def _recommendation_text_from_details(details: dict) -> str:
    steps = details.get("immediateSteps") or []
    if steps:
        return f"{details['overview']} Start with: {steps[0]} {details['followUp']}"
    return f"{details['overview']} {details['followUp']}"


@lru_cache
def get_gemini_client() -> genai.Client | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    return genai.Client(api_key=settings.gemini_api_key)


def generate_recommendation(
    *,
    crop: str,
    disease: str,
    status: str,
    confidence_percent: float,
    predictions: list[dict],
    fallback_recommendation: str,
) -> tuple[str, dict]:
    fallback_details = _fallback_details(
        crop=crop,
        disease=disease,
        status=status,
        confidence_percent=confidence_percent,
        fallback_recommendation=fallback_recommendation,
    )
    fallback_text = _recommendation_text_from_details(fallback_details)

    if status == "Review needed":
        return fallback_text, fallback_details

    client = get_gemini_client()
    settings = get_settings()
    if client is None:
        return fallback_text, fallback_details

    prompt = f"""
Crop: {crop}
Disease: {disease}
Diagnosis status: {status}
Confidence percent: {confidence_percent:.2f}
Primary fallback recommendation: {fallback_recommendation}
Model predictions:
{json.dumps(predictions, indent=2)}
""".strip()

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                systemInstruction=RECOMMENDATION_SYSTEM_PROMPT,
                temperature=0.2,
                maxOutputTokens=220,
            ),
        )
        ai_overview = _trim_text(
            response.text or "",
            fallback_details["overview"],
            600,
        )
        details = {**fallback_details, "overview": ai_overview}
        return _recommendation_text_from_details(details), details
    except Exception:
        logger.exception("Gemini recommendation generation failed. Falling back.")
        return fallback_text, fallback_details


def generate_chat_reply(
    *,
    analysis: dict,
    messages: list[dict],
    message: str,
) -> str:
    client = get_gemini_client()
    if client is None:
        if analysis["status"] == "Review needed":
            return (
                "This scan still needs review. I would start by taking a clearer close-up photo "
                "of one leaf, then compare nearby leaves for the same pattern before treating."
            )
        return (
            f"Based on the current diagnosis of {analysis['cropType']} - {analysis['condition']}, "
            f"{analysis['recommendation']} Ask about treatment timing, likely spread, or useful product categories."
        )

    settings = get_settings()
    history_lines: list[str] = []
    for item in messages[-8:]:
        role = item.get("role", "user")
        content = " ".join(str(item.get("content", "")).split()).strip()
        if content:
            history_lines.append(f"{role.title()}: {content}")

    prompt = f"""
Diagnosis context:
{json.dumps(analysis, indent=2)}

Recent chat:
{chr(10).join(history_lines) if history_lines else "No prior chat."}

User question:
{message}
""".strip()

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                systemInstruction=CHAT_SYSTEM_PROMPT,
                temperature=0.45,
                maxOutputTokens=500,
            ),
        )
        answer = _trim_text(
            response.text or "",
            "I could not generate a useful follow-up answer for this diagnosis yet.",
            2000,
        )
        return answer
    except Exception:
        logger.exception("Gemini diagnosis chat failed.")
        return (
            "I could not reach the diagnosis assistant right now. Try again in a moment, "
            "or use the current recommendation as your starting point."
        )
