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


def _product_recommendations_for(
    *,
    crop: str,
    disease: str,
    status: str,
) -> list[dict]:
    if status == "Review needed":
        return []

    lowered = disease.lower()
    if disease == "Healthy":
        return [
            {
                "title": "Clean pruning kit",
                "category": "Sanitation",
                "priority": "helpful",
                "useCase": "Keep tools clean between plants and reduce preventable spread during routine pruning.",
                "timing": "Use during every inspection or pruning session.",
                "buyerNote": "A basic bypass pruner plus tool disinfectant is enough for most small gardens.",
                "caution": "Disinfect between plants instead of only at the end of the work session.",
            },
            {
                "title": "Balanced plant nutrition",
                "category": "Plant care",
                "priority": "monitoring",
                "useCase": f"Support steady {crop.lower()} growth when no disease is currently detected.",
                "timing": "Use only when soil or plant condition suggests a need.",
                "buyerNote": "Choose a general vegetable or fruit fertilizer that matches the crop label.",
                "caution": "Avoid over-fertilizing; stressed growth can make plants easier to damage.",
            },
        ]

    if "mite" in lowered:
        return [
            {
                "title": "Hand lens",
                "category": "Monitoring",
                "priority": "essential",
                "useCase": "Check leaf undersides for mites, eggs, and webbing before treatment.",
                "timing": "Use before spraying and again three to five days later.",
                "buyerNote": "A low-cost 10x hand lens is enough for field checks.",
                "caution": "Do not treat for mites until you confirm activity on the leaf underside.",
            },
            {
                "title": "Insecticidal soap",
                "category": "Soft insect control",
                "priority": "helpful",
                "useCase": "Target light mite pressure with a low-residue contact treatment.",
                "timing": "Apply only when mites are present and the label fits the crop.",
                "buyerNote": "Look for products labeled for edible crops if the plant is food-bearing.",
                "caution": "Test a small area first; soaps can burn leaves in heat or strong sun.",
            },
        ]

    if "virus" in lowered or "greening" in lowered:
        return [
            {
                "title": "Tool disinfectant",
                "category": "Sanitation",
                "priority": "essential",
                "useCase": "Reduce mechanical spread while removing or handling suspicious plants.",
                "timing": "Use immediately before and after handling affected plants.",
                "buyerNote": "Prioritize disinfectants labeled for garden tools and hard surfaces.",
                "caution": "Disinfection helps with spread, but it does not cure infected plants.",
            },
            {
                "title": "Sticky monitoring traps",
                "category": "Vector monitoring",
                "priority": "monitoring",
                "useCase": "Track insects that can move viral diseases between plants.",
                "timing": "Place near the crop and check regularly during warm weather.",
                "buyerNote": "Yellow sticky cards are common for whitefly and aphid monitoring.",
                "caution": "Use traps as monitoring support, not as the only control method.",
            },
        ]

    if any(
        keyword in lowered
        for keyword in ["rust", "spot", "blight", "mildew", "rot", "mold", "scab"]
    ):
        primary_category = "Fungicide" if "bacterial" not in lowered else "Bactericide"
        return [
            {
                "title": f"Labeled {primary_category.lower()}",
                "category": primary_category,
                "priority": "helpful",
                "useCase": f"Consider treatment if {disease.lower()} continues spreading after sanitation and airflow improvements.",
                "timing": "Use after confirming the label matches the crop, disease, and harvest window.",
                "buyerNote": "Compare active ingredient, crop label, re-entry interval, and pre-harvest interval.",
                "caution": "Do not spray broadly from one scan alone; follow local label and extension guidance.",
            },
            {
                "title": "Pump sprayer",
                "category": "Application tool",
                "priority": "helpful",
                "useCase": "Apply labeled treatments evenly when treatment is justified.",
                "timing": "Use only after reading the product label and mixing instructions.",
                "buyerNote": "A small hand sprayer is enough for backyard plots; larger plots need better capacity.",
                "caution": "Keep sprayers labeled and avoid mixing herbicide and crop-treatment equipment.",
            },
            {
                "title": "Pruning shears",
                "category": "Sanitation",
                "priority": "essential",
                "useCase": "Remove badly affected leaves or stems when appropriate for the crop.",
                "timing": "Use during dry conditions when plant tissue is easier to handle cleanly.",
                "buyerNote": "Choose shears that can be cleaned easily between plants.",
                "caution": "Removing too much foliage can stress the plant; prune conservatively.",
            },
        ]

    return [
        {
            "title": "Protective gloves",
            "category": "Handling",
            "priority": "helpful",
            "useCase": "Handle affected leaves while reducing plant-to-plant contamination.",
            "timing": "Use when inspecting, pruning, or removing affected tissue.",
            "buyerNote": "Reusable washable gloves are fine for most garden checks.",
            "caution": "Wash or change gloves before touching healthy plants.",
        }
    ]


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
            "productRecommendations": [],
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
        "productRecommendations": _product_recommendations_for(
            crop=crop,
            disease=disease,
            status=status,
        ),
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
