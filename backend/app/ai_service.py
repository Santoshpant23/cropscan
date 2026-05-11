import json
import logging
import time
from functools import lru_cache
from typing import Literal

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.config import get_settings

FALLBACK_CHAT_PREFIX = "The live assistant is unavailable right now"

# Gemini on Vertex uses Dynamic Shared Quota — short bursts can return 429 even
# with billing enabled. Retry briefly with exponential backoff before falling
# back. The total max wait is 1+2+4 = 7s before we give up and use local guidance.
_RETRY_BACKOFF_SECONDS = (1.0, 2.0, 4.0)

logger = logging.getLogger(__name__)


def _generate_with_retry(client: genai.Client, **kwargs):
    """Call client.models.generate_content with backoff on 429.

    Re-raises any non-429 ClientError or other exception so callers can apply
    their own fallback. Returns the successful response object.
    """
    last_exc: Exception | None = None
    for attempt, wait_seconds in enumerate((0.0, *_RETRY_BACKOFF_SECONDS)):
        if wait_seconds:
            time.sleep(wait_seconds)
        try:
            return client.models.generate_content(**kwargs)
        except genai_errors.ClientError as exc:
            if getattr(exc, "code", None) != 429:
                raise
            last_exc = exc
            logger.warning(
                "Gemini 429 on attempt %d/%d (status=%s); backing off %.1fs.",
                attempt + 1,
                len(_RETRY_BACKOFF_SECONDS) + 1,
                getattr(exc, "status", None),
                _RETRY_BACKOFF_SECONDS[attempt] if attempt < len(_RETRY_BACKOFF_SECONDS) else 0.0,
            )
    assert last_exc is not None
    raise last_exc

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

WALK_SUMMARY_SYSTEM_PROMPT = """
You are CropScan's scouting assistant. The grower walked along a row of plants
while recording video. We sampled frames and scored each one against a healthy
baseline taken from the start of the walk, using a foundation-model embedding.
Higher anomaly scores mean the frame looked different from the healthy baseline,
which often (but not always) means disease, pest damage, water stress, or
camera issues.

Write a short, plain-English scouting note in 60 to 110 words. Tell the grower
what most of the row looks like, point at the most suspicious time windows in
seconds, and suggest one or two next actions (usually: walk back to that section
and take a close-up photo for a single-leaf scan). Do not invent disease names.
Do not promise a diagnosis. Do not mention products or brands.
""".strip()

DISEASE_LABEL_SYSTEM_PROMPT = """
You turn raw PlantVillage classifier labels into plain English for farm workers.
Return only compact JSON with two string fields:
friendlyName: a short common name, 2 to 8 words.
explanation: one sentence under 120 characters explaining what it means.
Do not mention treatment, certainty, products, or model confidence.
""".strip()


def _trim_text(value: str, fallback: str, max_length: int) -> str:
    cleaned = " ".join(value.split()).strip()
    if not cleaned:
        cleaned = fallback
    if len(cleaned) <= max_length:
        return cleaned

    clipped = cleaned[:max_length].rstrip()
    sentence_end = max(clipped.rfind("."), clipped.rfind("!"), clipped.rfind("?"))
    if sentence_end >= int(max_length * 0.6):
        return clipped[: sentence_end + 1]
    return clipped


def _fallback_friendly_disease_label(raw_label: str) -> dict:
    disease_part = raw_label
    if "___" in raw_label:
        _crop_part, disease_part = raw_label.split("___", 1)
    elif raw_label.startswith("Tomato__Tomato_"):
        disease_part = raw_label.replace("Tomato__Tomato_", "", 1)
    elif raw_label.startswith("Tomato__"):
        disease_part = raw_label.replace("Tomato__", "", 1)
    elif raw_label.startswith("Tomato_"):
        disease_part = raw_label.replace("Tomato_", "", 1)

    friendly_name = (
        disease_part.replace("__", " ")
        .replace("_", " ")
        .replace("(", " (")
        .replace("  ", " ")
        .strip()
        .title()
    )
    friendly_name = friendly_name.replace("Haunglongbing", "Huanglongbing")
    if friendly_name.lower() == "healthy":
        return {
            "friendlyName": "Healthy",
            "explanation": "Leaf looks healthy with no obvious disease pattern.",
        }
    if "mite" in friendly_name.lower():
        explanation = "Tiny mites causing speckled, bronzed, or webbed leaves."
    elif "virus" in friendly_name.lower():
        explanation = "Viral disease that can distort, yellow, or stunt leaves."
    elif any(
        keyword in friendly_name.lower()
        for keyword in ["spot", "blight", "rot", "rust", "mildew", "mold", "scab"]
    ):
        explanation = "Leaf damage commonly linked to a fungal or bacterial disease."
    else:
        explanation = "Plant condition detected by the crop disease classifier."

    return {
        "friendlyName": _trim_text(friendly_name, "Unknown condition", 80),
        "explanation": _trim_text(explanation, "Plant condition detected by CropScan.", 160),
    }


@lru_cache(maxsize=128)
def generate_friendly_disease_label(raw_label: str) -> dict:
    """Ask Gemini for farmer-friendly disease text, with a deterministic fallback."""

    fallback = _fallback_friendly_disease_label(raw_label)
    client = get_gemini_client()
    if client is None:
        return fallback

    settings = get_settings()
    prompt = f"Raw PlantVillage label: {raw_label}"
    try:
        response = _generate_with_retry(
            client,
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                systemInstruction=DISEASE_LABEL_SYSTEM_PROMPT,
                temperature=0.1,
                maxOutputTokens=120,
                responseMimeType="application/json",
            ),
        )
        payload = json.loads(response.text or "{}")
        friendly_name = _trim_text(
            str(payload.get("friendlyName") or ""),
            fallback["friendlyName"],
            80,
        )
        explanation = _trim_text(
            str(payload.get("explanation") or ""),
            fallback["explanation"],
            160,
        )
        return {"friendlyName": friendly_name, "explanation": explanation}
    except genai_errors.ClientError as exc:
        logger.warning(
            "Gemini disease label generation failed (code=%s). Falling back.",
            getattr(exc, "code", None),
        )
        return fallback
    except Exception:
        logger.exception("Gemini disease label generation failed. Falling back.")
        return fallback


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
    if settings.gemini_use_vertex:
        if not settings.google_cloud_project:
            logger.warning(
                "GEMINI_USE_VERTEX=true but GOOGLE_CLOUD_PROJECT is not set; "
                "falling back to no-AI guidance."
            )
            return None
        try:
            client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
            logger.warning(
                "Gemini=Vertex AI (project=%s location=%s model=%s)",
                settings.google_cloud_project,
                settings.google_cloud_location,
                settings.gemini_model,
            )
            return client
        except Exception:
            logger.exception(
                "Failed to initialize Vertex AI Gemini client; falling back."
            )
            return None
    if not settings.gemini_api_key:
        logger.warning("Gemini disabled (no api_key, no Vertex config).")
        return None
    logger.warning(
        "Gemini=AI Studio (api_key=set model=%s) — DOES NOT use the GCP $300 credit.",
        settings.gemini_model,
    )
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
        response = _generate_with_retry(
            client,
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
    except genai_errors.ClientError as exc:
        code = getattr(exc, "code", None)
        msg = (getattr(exc, "message", "") or "")[:300]
        if code == 429:
            logger.warning(
                "Gemini 429 after retries on recommendation (status=%s, msg=%s).",
                getattr(exc, "status", None),
                msg,
            )
        else:
            logger.exception(
                "Gemini recommendation generation failed (code=%s, msg=%s).",
                code,
                msg,
            )
        return fallback_text, fallback_details
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
        response = _generate_with_retry(
            client,
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
    except genai_errors.ClientError as exc:
        code = getattr(exc, "code", None)
        msg = (getattr(exc, "message", "") or "")[:300]
        if code == 429:
            logger.warning(
                "Gemini 429 after retries on chat (status=%s, msg=%s).",
                getattr(exc, "status", None),
                msg,
            )
        else:
            logger.exception(
                "Gemini diagnosis chat failed (code=%s, msg=%s).", code, msg
            )
        return _local_chat_fallback(analysis)
    except Exception:
        logger.exception("Gemini diagnosis chat failed.")
        return _local_chat_fallback(analysis)


def _local_chat_fallback(analysis: dict) -> str:
    saved = " ".join(str(analysis.get("recommendation") or "").split()).strip()
    if not saved:
        saved = (
            "Inspect more leaves on the same plant, then re-scan in better light "
            "before treating."
        )
    return (
        f"{FALLBACK_CHAT_PREFIX} (likely API quota). Saved guidance for this scan: "
        f"{saved} You can ask about timing, monitoring, or when to re-scan once the "
        "live assistant is back."
    )


def _walk_summary_fallback(analysis: dict) -> str:
    valid = int(analysis.get("validFrameCount") or 0)
    skipped = int(analysis.get("skippedFrameCount") or 0)
    calibration = int(analysis.get("calibrationFrameCount") or 0)
    suspicious_windows = analysis.get("suspiciousWindows") or []

    if valid == 0 and calibration > 0:
        return (
            "Walk Scan only saw the calibration frames; you stopped before "
            "actually walking the row. Try again, hold steady on a healthy "
            "section, then walk for at least 5 seconds before stopping."
        )

    if valid == 0:
        return (
            "Most of the frames in this walk did not have enough plant signal "
            "for a useful read. Walk closer to the row, fill the frame with "
            "leaves, and try again in steady light."
        )

    if not suspicious_windows:
        skipped_note = (
            f" {skipped} frames were skipped for blur or background." if skipped else ""
        )
        return (
            f"The walk looked uniform against the healthy baseline. "
            f"No clear suspicious section showed up across {valid} scored frames."
            f"{skipped_note} Keep an eye on the row and rescan in a few days."
        )

    window_phrases = []
    for window in suspicious_windows[:3]:
        start = int(window.get("startMs") or 0) // 1000
        end = max(start + 1, int(window.get("endMs") or 0) // 1000)
        window_phrases.append(f"{start}-{end}s")
    locations = ", ".join(window_phrases)
    return (
        f"Most of the row tracked the healthy baseline, but the section around "
        f"{locations} stood out from the rest. Walk back to that part of the row "
        "and take a close-up photo of the worst-looking leaf so CropScan can run "
        "a single-leaf scan."
    )


def generate_walk_summary(analysis: dict) -> str:
    """Turn a Walk Scan analysis dict into farmer-friendly language.

    Falls back to a deterministic summary when Gemini is not configured or
    the API call fails. The fallback is good enough on its own; Gemini just
    makes it nicer.
    """

    fallback = _walk_summary_fallback(analysis)
    client = get_gemini_client()
    if client is None:
        return fallback

    settings = get_settings()
    prompt = (
        "Walk Scan summary input:\n"
        f"{json.dumps(analysis, indent=2)}\n"
    )
    try:
        response = _generate_with_retry(
            client,
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                systemInstruction=WALK_SUMMARY_SYSTEM_PROMPT,
                temperature=0.35,
                maxOutputTokens=260,
            ),
        )
        return _trim_text(response.text or "", fallback, 800)
    except genai_errors.ClientError as exc:
        code = getattr(exc, "code", None)
        msg = (getattr(exc, "message", "") or "")[:300]
        if code == 429:
            logger.warning(
                "Gemini 429 after retries on walk summary (status=%s, msg=%s).",
                getattr(exc, "status", None),
                msg,
            )
        else:
            logger.exception(
                "Gemini walk summary generation failed (code=%s, msg=%s).", code, msg
            )
        return fallback
    except Exception:
        logger.exception("Gemini walk summary generation failed. Falling back.")
        return fallback
