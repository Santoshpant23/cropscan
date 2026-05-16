import json
import logging
from collections import Counter
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image
import torch
from torch import nn
from torchvision import models, transforms

from app.ai_service import generate_recommendation
from app.config import get_settings

logger = logging.getLogger(__name__)

CLASS_NAMES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper__bell___Bacterial_spot",
    "Pepper__bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato_Bacterial_spot",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_Leaf_Mold",
    "Tomato_Septoria_leaf_spot",
    "Tomato_Spider_mites_Two_spotted_spider_mite",
    "Tomato__Target_Spot",
    "Tomato__Tomato_YellowLeaf__Curl_Virus",
    "Tomato__Tomato_mosaic_virus",
    "Tomato_healthy",
]

CONFIDENCE_THRESHOLD = 0.70
DEFAULT_MARGIN_THRESHOLD = 0.20
DEFAULT_ENTROPY_THRESHOLD = 0.55
LEAF_DETECTOR_THRESHOLD = 0.12
LEAF_GREEN_RATIO_THRESHOLD = 0.10
LEAF_TOPK_PLANT_HITS_THRESHOLD = 2
LEAF_STRONG_GREEN_RATIO_THRESHOLD = 0.20
LEAF_MIN_PLANT_CONFIDENCE_THRESHOLD = 0.10
BACKEND_ROOT = Path(__file__).resolve().parents[1]
LEAF_DETECTOR_KEYWORDS = {
    "leaf",
    "plant",
    "flower",
    "tree",
    "herb",
    "shrub",
    "vine",
    "vegetable",
    "fruit",
    "fungus",
    "mushroom",
    "corn",
    "ear",
    "acorn",
    "buckeye",
    "fig",
    "strawberry",
    "orange",
    "lemon",
    "pineapple",
    "banana",
    "cucumber",
    "pepper",
    "cauliflower",
    "broccoli",
    "cabbage",
    "artichoke",
    "daisy",
    "sunflower",
    "rose",
    "rapeseed",
}

IMAGE_TRANSFORM = transforms.Compose(
    [
        transforms.Resize(312),
        transforms.CenterCrop(280),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

RECOMMENDATIONS = {
    "Healthy": "The leaf looks healthy. Keep monitoring the plant, maintain airflow, and avoid overwatering.",
    "Bacterial Spot": "Remove infected leaves, avoid overhead watering, and disinfect tools between plants. Confirm locally before applying any copper-based treatment.",
    "Apple Scab": "Remove fallen leaves, improve airflow around the tree, and avoid overhead irrigation when possible. Confirm local orchard treatment guidance before spraying.",
    "Black Rot": "Remove infected leaves or fruit, prune for airflow, and avoid leaving diseased plant material nearby. Local extension guidance is useful before fungicide treatment.",
    "Cedar Apple Rust": "Remove nearby alternate hosts if practical, prune affected tissue, and monitor new growth closely. Use local extension guidance for orchard management decisions.",
    "Powdery Mildew": "Remove heavily affected tissue, improve airflow, and avoid crowding plants. Treat only with a labeled product if symptoms keep spreading.",
    "Cercospora Leaf Spot / Gray Leaf Spot": "Remove infected debris where possible, reduce leaf wetness, and rotate crops if applicable. Monitor nearby leaves for additional lesions.",
    "Common Rust": "Monitor spread across the plant canopy, reduce plant stress, and consult local crop guidance if infection is moving quickly. Remove badly affected leaves when practical.",
    "Northern Leaf Blight": "Remove or isolate heavily affected foliage if practical and avoid working plants when leaves are wet. Monitor disease spread and confirm local treatment guidance.",
    "Early Blight": "Remove lower infected leaves, improve airflow, and keep soil from splashing onto foliage. Consider labeled fungicide guidance if spread continues.",
    "Late Blight": "Separate affected plants where possible, remove heavily infected foliage, and avoid overhead watering. Contact a local extension office quickly because late blight can spread fast.",
    "Leaf Mold": "Increase airflow, reduce leaf wetness, and remove badly infected leaves. Greenhouse or dense plantings may need humidity control.",
    "Esca (Black Measles)": "Remove severely affected tissue where appropriate and monitor vine health closely. Vineyard-specific treatment decisions should follow local expert guidance.",
    "Leaf Blight (Isariopsis Leaf Spot)": "Remove heavily affected leaves, improve airflow, and avoid extended leaf wetness. Monitor surrounding foliage for new spotting.",
    "Huanglongbing (Citrus Greening)": "This can be a serious citrus disease. Isolate affected plants if possible and contact a local extension office or plant health authority for confirmation and next steps.",
    "Leaf Scorch": "Remove badly scorched leaves if needed, reduce plant stress, and check watering and general plant health. Monitor for additional spread or pattern changes.",
    "Septoria Leaf Spot": "Remove spotted leaves, mulch to reduce soil splash, and avoid working plants when wet. Use local extension guidance before treatment.",
    "Spider Mites Two Spotted Spider Mite": "Check leaf undersides for mites, rinse foliage with water, and reduce plant stress. Severe cases may need a labeled miticide or expert guidance.",
    "Target Spot": "Remove affected leaves and improve airflow around plants. Avoid overhead watering and monitor nearby plants for new lesions.",
    "Tomato Yellow Leaf Curl Virus": "Remove severely affected plants and control whiteflies with locally recommended methods. Do not compost infected plants.",
    "Tomato Mosaic Virus": "Remove infected plants, wash hands and tools, and avoid handling healthy plants after touching symptomatic leaves.",
}

CROP_DISPLAY_NAMES = {
    "Cherry_(including_sour)": "Cherry",
    "Corn_(maize)": "Corn",
    "Pepper__bell": "Bell pepper",
}

DISEASE_DISPLAY_NAMES = {
    "Apple_scab": "Apple Scab",
    "Black_rot": "Black Rot",
    "Cedar_apple_rust": "Cedar Apple Rust",
    "healthy": "Healthy",
    "Powdery_mildew": "Powdery Mildew",
    "Cercospora_leaf_spot Gray_leaf_spot": "Cercospora Leaf Spot / Gray Leaf Spot",
    "Common_rust_": "Common Rust",
    "Northern_Leaf_Blight": "Northern Leaf Blight",
    "Esca_(Black_Measles)": "Esca (Black Measles)",
    "Leaf_blight_(Isariopsis_Leaf_Spot)": "Leaf Blight (Isariopsis Leaf Spot)",
    "Haunglongbing_(Citrus_greening)": "Huanglongbing (Citrus Greening)",
    "Bacterial_spot": "Bacterial Spot",
    "Early_blight": "Early Blight",
    "Late_blight": "Late Blight",
    "Leaf_Mold": "Leaf Mold",
    "Leaf_scorch": "Leaf Scorch",
    "Septoria_leaf_spot": "Septoria Leaf Spot",
    "Spider_mites_Two_spotted_spider_mite": "Spider Mites Two Spotted Spider Mite",
    "Target_Spot": "Target Spot",
    "Tomato_YellowLeaf__Curl_Virus": "Tomato Yellow Leaf Curl Virus",
    "Tomato_mosaic_virus": "Tomato Mosaic Virus",
}


def _model_path(file_name: str) -> Path:
    settings = get_settings()
    model_dir = Path(settings.model_dir)
    if not model_dir.is_absolute():
        model_dir = BACKEND_ROOT / model_dir
    return model_dir / file_name


def _default_calibration() -> dict:
    return {
        "temperature": 1.0,
        "thresholds": {
            "max_prob_min": CONFIDENCE_THRESHOLD,
            "margin_min": DEFAULT_MARGIN_THRESHOLD,
            "entropy_max": DEFAULT_ENTROPY_THRESHOLD,
        },
    }


@lru_cache(maxsize=1)
def _load_calibration_metadata() -> dict:
    model_keys = {
        "DINOv2-LoRA": "dinov2_lora_vits14",
        "EfficientNetV2-S": "efficientnet_v2_s",
    }
    defaults = {model_name: _default_calibration() for model_name in model_keys}
    report_path = _model_path("training_report.json")
    if not report_path.exists():
        logger.warning(
            "No training_report.json found in %s. Using default calibration thresholds.",
            report_path.parent,
        )
        return defaults

    try:
        with report_path.open("r", encoding="utf-8") as file:
            report = json.load(file)
    except (OSError, json.JSONDecodeError):
        logger.exception("Could not load model calibration metadata.")
        return defaults

    calibrated = {}
    for display_name, report_key in model_keys.items():
        entry = report.get(report_key) or {}
        thresholds = entry.get("thresholds") or entry.get("abstention_thresholds") or {}
        calibrated[display_name] = {
            "temperature": float(entry.get("temperature") or 1.0),
            "thresholds": {
                "max_prob_min": float(
                    thresholds.get("max_prob_min") or CONFIDENCE_THRESHOLD
                ),
                "margin_min": float(
                    thresholds.get("margin_min") or DEFAULT_MARGIN_THRESHOLD
                ),
                "entropy_max": float(
                    thresholds.get("entropy_max") or DEFAULT_ENTROPY_THRESHOLD
                ),
            },
        }
    return calibrated


import math


class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: float = 16.0):
        super().__init__()
        self.base = base
        for parameter in self.base.parameters():
            parameter.requires_grad = False
        in_features, out_features = base.in_features, base.out_features
        self.lora_A = nn.Parameter(torch.empty(r, in_features))
        self.lora_B = nn.Parameter(torch.zeros(out_features, r))
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        self.scaling = alpha / r

    def forward(self, x):
        return self.base(x) + (x @ self.lora_A.t()) @ self.lora_B.t() * self.scaling


class DINOv2LoRAClassifier(nn.Module):
    def __init__(
        self,
        num_classes: int,
        lora_r: int = 8,
        lora_alpha: float = 16.0,
        embed_dim: int = 384,
        hidden: int = 512,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.backbone = torch.hub.load(
            "facebookresearch/dinov2", "dinov2_vits14", skip_validation=True
        )
        for parameter in self.backbone.parameters():
            parameter.requires_grad = False
        for block in self.backbone.blocks:
            block.attn.qkv = LoRALinear(block.attn.qkv, r=lora_r, alpha=lora_alpha)
            block.attn.proj = LoRALinear(block.attn.proj, r=lora_r, alpha=lora_alpha)
        self.backbone.eval()
        self.head = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Linear(embed_dim, hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, num_classes),
        )

    def train(self, mode: bool = True):
        super().train(mode)
        self.backbone.eval()
        return self

    def forward(self, x):
        return self.head(self.backbone(x))


def _build_dinov2_lora_vits14() -> nn.Module:
    return DINOv2LoRAClassifier(len(CLASS_NAMES))


def _build_efficientnet_v2_s() -> nn.Module:
    model = models.efficientnet_v2_s(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(0.3, inplace=True),
        nn.Linear(model.classifier[1].in_features, len(CLASS_NAMES)),
    )
    return model


def _build_leaf_detector(device: torch.device) -> dict:
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V2
    try:
        model = models.mobilenet_v2(weights=weights)
    except Exception as exc:  # pragma: no cover - depends on local weight cache
        raise RuntimeError(
            "Could not load the ImageNet leaf detector weights. Run the backend once "
            "with internet access so torchvision can cache MobileNetV2 weights."
        ) from exc

    categories = weights.meta["categories"]
    plant_indices = [
        index
        for index, category in enumerate(categories)
        if any(keyword in category.lower() for keyword in LEAF_DETECTOR_KEYWORDS)
    ]
    if not plant_indices:  # pragma: no cover - defensive config guard
        raise RuntimeError("Leaf detector could not map any plant-related ImageNet classes.")

    model.to(device)
    model.eval()
    return {
        "model": model,
        "categories": categories,
        "plant_indices": plant_indices,
        "transform": weights.transforms(),
    }


def _load_state_dict(model: nn.Module, path: Path, device: torch.device) -> nn.Module:
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")
    state_dict = torch.load(path, map_location=device, weights_only=True)
    try:
        model.load_state_dict(state_dict)
    except RuntimeError as exc:
        checkpoint_num_classes = None
        for key, value in state_dict.items():
            if key.endswith(".weight") and getattr(value, "ndim", 0) == 2:
                checkpoint_num_classes = int(value.shape[0])
                break

        if checkpoint_num_classes and checkpoint_num_classes != len(CLASS_NAMES):
            raise RuntimeError(
                f"Checkpoint {path.name} outputs {checkpoint_num_classes} classes, "
                f"but the backend is configured for {len(CLASS_NAMES)} classes. "
                "Update backend/app/inference.py to use the same class list and "
                "classifier size as the newly trained models."
            ) from exc
        raise
    model.to(device)
    model.eval()
    return model


@lru_cache
def get_model_bundle() -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return {
        "device": device,
        "leafDetector": _build_leaf_detector(device),
        "models": {
            "DINOv2-LoRA": _load_state_dict(
                _build_dinov2_lora_vits14(),
                _model_path("dinov2_lora_vits14_cropscan_v5.pth"),
                device,
            ),
            "EfficientNetV2-S": _load_state_dict(
                _build_efficientnet_v2_s(),
                _model_path("efficientnet_v2_s_cropscan_v5.pth"),
                device,
            ),
        },
        "calibration": _load_calibration_metadata(),
    }


def _split_class_name(class_name: str) -> tuple[str, str]:
    if "___" in class_name:
        return class_name.split("___", 1)
    if class_name.startswith("Tomato__Tomato_"):
        return "Tomato", class_name.replace("Tomato__Tomato_", "", 1)
    if class_name.startswith("Tomato__"):
        return "Tomato", class_name.replace("Tomato__", "", 1)
    if class_name.startswith("Tomato_"):
        return "Tomato", class_name.replace("Tomato_", "", 1)
    raise ValueError(f"Unsupported class name format: {class_name}")


def _class_to_crop(class_name: str) -> str:
    crop_name, _ = _split_class_name(class_name)
    if crop_name in CROP_DISPLAY_NAMES:
        return CROP_DISPLAY_NAMES[crop_name]
    return crop_name.replace("__", " ").replace("_", " ").strip().title()


def _class_to_disease(class_name: str) -> str:
    _, disease_name = _split_class_name(class_name)
    if disease_name in DISEASE_DISPLAY_NAMES:
        return DISEASE_DISPLAY_NAMES[disease_name]
    return disease_name.replace("__", " ").replace("_", " ").strip().title()


def _prediction_from_index(index: int, probability: float) -> dict:
    class_name = CLASS_NAMES[index]
    disease = _class_to_disease(class_name)
    return {
        "className": class_name,
        "crop": _class_to_crop(class_name),
        "disease": disease,
        "confidence": round(float(probability), 4),
        "confidencePercent": round(float(probability) * 100, 2),
        "isHealthy": disease == "Healthy",
    }


def _green_ratio(image: Image.Image) -> float:
    resized = image.resize((224, 224))
    pixels = np.asarray(resized, dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    green_mask = (
        (green > 60)
        & (green > red * 1.12)
        & (green > blue * 1.08)
    )
    return float(green_mask.mean())


def _detect_leaf_image(bundle: dict, image: Image.Image) -> dict:
    detector = bundle["leafDetector"]
    device = bundle["device"]
    image_tensor = detector["transform"](image).unsqueeze(0).to(device)

    with torch.no_grad():
        probabilities = torch.softmax(detector["model"](image_tensor), dim=1)[0]

    plant_confidence = float(probabilities[detector["plant_indices"]].sum().item())
    top_confidence, top_index = torch.max(probabilities, dim=0)
    top_probabilities, top_indices = torch.topk(probabilities, k=5)
    top_index_value = int(top_index.item())
    top_categories = [
        detector["categories"][int(index)] for index in top_indices.cpu().tolist()
    ]
    top_plant_hits = sum(
        1
        for category in top_categories
        if any(keyword in category.lower() for keyword in LEAF_DETECTOR_KEYWORDS)
    )
    green_ratio = _green_ratio(image)
    is_leaf = (
        (
            plant_confidence >= LEAF_DETECTOR_THRESHOLD
            and (
                green_ratio >= LEAF_GREEN_RATIO_THRESHOLD
                or top_plant_hits >= LEAF_TOPK_PLANT_HITS_THRESHOLD
            )
        )
        or (
            plant_confidence >= LEAF_MIN_PLANT_CONFIDENCE_THRESHOLD
            and green_ratio >= LEAF_STRONG_GREEN_RATIO_THRESHOLD
        )
    )

    return {
        "isLeaf": is_leaf,
        "plantConfidence": round(plant_confidence, 4),
        "greenRatio": round(green_ratio, 4),
        "topPlantHits": top_plant_hits,
        "topImagenetClass": detector["categories"][top_index_value],
        "topImagenetConfidence": round(float(top_confidence.item()), 4),
        "threshold": LEAF_DETECTOR_THRESHOLD,
        "topImagenetClasses": [
            {
                "className": category,
                "confidence": round(float(probability), 4),
            }
            for category, probability in zip(
                top_categories, top_probabilities.cpu().tolist()
            )
        ],
    }


def _predict_model(
    model: nn.Module,
    model_name: str,
    image_tensor: torch.Tensor,
    calibration: dict,
) -> dict:
    model_calibration = calibration.get(model_name) or _default_calibration()
    temperature = max(float(model_calibration["temperature"]), 0.01)
    thresholds = model_calibration["thresholds"]
    with torch.no_grad():
        logits = model(image_tensor)
        probabilities = torch.softmax(logits / temperature, dim=1)[0]
    entropy = -torch.sum(probabilities * torch.log(probabilities.clamp_min(1e-8)))
    normalized_entropy = float(entropy.item() / torch.log(torch.tensor(len(CLASS_NAMES))).item())
    top_probabilities, top_indices = torch.topk(probabilities, k=3)
    top_k = [
        _prediction_from_index(int(index), float(probability))
        for probability, index in zip(top_probabilities.cpu(), top_indices.cpu())
    ]
    top_prediction = top_k[0]
    confidence_margin = top_k[0]["confidence"] - top_k[1]["confidence"]
    return {
        "modelName": model_name,
        **top_prediction,
        "confident": (
            top_prediction["confidence"] >= thresholds["max_prob_min"]
            and confidence_margin >= thresholds["margin_min"]
            and normalized_entropy <= thresholds["entropy_max"]
        ),
        "confidenceMargin": round(float(confidence_margin), 4),
        "entropy": round(float(normalized_entropy), 4),
        "temperature": round(float(temperature), 4),
        "thresholds": {
            "maxProbMin": round(float(thresholds["max_prob_min"]), 4),
            "marginMin": round(float(thresholds["margin_min"]), 4),
            "entropyMax": round(float(thresholds["entropy_max"]), 4),
        },
        "topK": top_k,
    }


def _recommendation_for(predictions: list[dict], status: str) -> str:
    if status == "Review needed":
        return "The models are not confident enough to diagnose this image. Try a brighter, closer photo with one main leaf or consult a local extension office."
    disease = predictions[0]["disease"]
    return RECOMMENDATIONS.get(
        disease,
        "Monitor the plant closely, isolate affected leaves if symptoms spread, and confirm with a local extension office before treatment.",
    )


def _diagnosis_state(predictions: list[dict], same_top_class: bool) -> dict:
    all_confident = all(prediction["confident"] for prediction in predictions)

    if same_top_class and all_confident:
        return {
            "diagnosisState": "confident",
            "diagnosisStateLabel": "Confident",
            "diagnosisReason": (
                "Both models agree, confidence is high, and the top class is clearly separated."
            ),
        }

    return {
        "diagnosisState": "uncertain_need_more_photos",
        "diagnosisStateLabel": "Uncertain - add another photo",
        "diagnosisReason": (
            "The model output is not stable enough for a final diagnosis. Add a closer "
            "leaf photo, a leaf-back photo, or an environment photo before treating."
        ),
    }


def _out_of_scope_response(filename: str, image: Image.Image, leaf_validation: dict) -> dict:
    recommendation = (
        "This image does not look like a clear supported crop leaf. Take a close-up "
        "photo of one leaf in bright, even lighting, with the leaf filling most of "
        "the frame."
    )
    return {
        "fileName": filename,
        "imageSize": {"width": image.width, "height": image.height},
        "leafValidation": leaf_validation,
        "cropType": "Out of scope",
        "condition": "Not a clear crop leaf",
        "confidenceScore": 0,
        "confidencePercent": 0,
        "status": "Review needed",
        "diagnosisState": "out_of_scope",
        "diagnosisStateLabel": "Out of scope",
        "diagnosisReason": (
            "The leaf gate could not verify enough plant signal for diagnosis."
        ),
        "recommendation": recommendation,
        "recommendationDetails": {
            "headline": "Retake the leaf photo",
            "urgency": "low",
            "overview": recommendation,
            "immediateSteps": [
                "Use a close-up photo with one main leaf.",
                "Avoid busy soil, sky, hands, tools, or multiple plants in the background.",
                "If symptoms are on the leaf underside, capture the underside separately.",
            ],
            "productCategories": [],
            "productRecommendations": [],
            "cautions": [
                "Do not treat the plant from this image because it is outside the supported diagnosis path.",
            ],
            "followUp": "Upload a clearer crop leaf image and run the scan again.",
        },
        "predictions": [],
    }


def predict_leaf_image(image_bytes: bytes, filename: str) -> dict:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    bundle = get_model_bundle()
    leaf_validation = _detect_leaf_image(bundle, image)
    if not leaf_validation["isLeaf"]:
        return _out_of_scope_response(filename, image, leaf_validation)

    device = bundle["device"]
    image_tensor = IMAGE_TRANSFORM(image).unsqueeze(0).to(device)

    predictions = [
        _predict_model(model, model_name, image_tensor, bundle["calibration"])
        for model_name, model in bundle["models"].items()
    ]
    same_top_class = len({prediction["className"] for prediction in predictions}) == 1
    diagnosis_state = _diagnosis_state(predictions, same_top_class)
    status = (
        "High confidence"
        if diagnosis_state["diagnosisState"] == "confident"
        else "Review needed"
    )

    best_prediction = max(predictions, key=lambda prediction: prediction["confidence"])
    fallback_recommendation = _recommendation_for(predictions, status)
    display_crop = best_prediction["crop"]
    display_condition = best_prediction["disease"]
    if status != "High confidence":
        display_crop = display_crop if same_top_class else "Multiple possibilities"
        display_condition = "Needs clearer photo"

    recommendation, recommendation_details = generate_recommendation(
        crop=best_prediction["crop"],
        disease=best_prediction["disease"],
        status=status,
        confidence_percent=best_prediction["confidencePercent"],
        predictions=predictions,
        fallback_recommendation=fallback_recommendation,
    )
    return {
        "fileName": filename,
        "imageSize": {"width": image.width, "height": image.height},
        "leafValidation": leaf_validation,
        "cropType": display_crop,
        "condition": display_condition,
        "confidenceScore": best_prediction["confidence"],
        "confidencePercent": best_prediction["confidencePercent"],
        "status": status,
        **diagnosis_state,
        "recommendation": recommendation,
        "recommendationDetails": recommendation_details,
        "predictions": predictions,
    }


def _multi_photo_uncertain_recommendation() -> tuple[str, dict]:
    recommendation = (
        "The photos do not agree enough for a treatment recommendation. Add one "
        "close-up symptom photo, one leaf-back photo, and one wider plant photo before "
        "applying any product."
    )
    return recommendation, {
        "headline": "Add another photo before treating",
        "urgency": "medium",
        "overview": recommendation,
        "immediateSteps": [
            "Capture the most damaged leaf close up.",
            "Capture the underside of the same leaf if possible.",
            "Capture a wider photo showing the plant and nearby leaves.",
        ],
        "productCategories": [],
        "productRecommendations": [],
        "cautions": [
            "Do not buy or apply disease-specific products until the photos converge.",
            "If disease is spreading quickly, contact a local extension office.",
        ],
        "followUp": (
            "Run the scan again with multiple angles so CropScan can separate disease, "
            "lighting, and background effects."
        ),
    }


def _tag_photo_predictions(photo_result: dict) -> list[dict]:
    photo_index = photo_result["photoIndex"]
    tagged_predictions = []
    for prediction in photo_result.get("predictions") or []:
        tagged_predictions.append(
            {
                **prediction,
                "modelName": f"Photo {photo_index}: {prediction['modelName']}",
                "photoIndex": photo_index,
                "photoFileName": photo_result["fileName"],
            }
        )
    return tagged_predictions


def predict_leaf_images(image_payloads: list[tuple[bytes, str]]) -> dict:
    if not image_payloads:
        raise ValueError("Upload at least one leaf image.")
    if len(image_payloads) > 3:
        raise ValueError("Upload at most three leaf images for one diagnosis.")

    photo_results = []
    for photo_index, (image_bytes, filename) in enumerate(image_payloads, start=1):
        result = predict_leaf_image(image_bytes, filename)
        result["photoIndex"] = photo_index
        photo_results.append(result)

    if len(photo_results) == 1:
        single_result = photo_results[0]
        return {
            **single_result,
            "photoCount": 1,
            "photoResults": photo_results,
        }

    valid_photo_results = [
        photo_result for photo_result in photo_results if photo_result.get("predictions")
    ]
    tagged_predictions = [
        prediction
        for photo_result in photo_results
        for prediction in _tag_photo_predictions(photo_result)
    ]

    if not valid_photo_results:
        recommendation, recommendation_details = _multi_photo_uncertain_recommendation()
        return {
            "fileName": f"{len(photo_results)} photos",
            "imageSize": photo_results[0].get("imageSize"),
            "leafValidation": {
                "photoCount": len(photo_results),
                "validLeafPhotos": 0,
                "outOfScopePhotos": len(photo_results),
            },
            "photoCount": len(photo_results),
            "photoResults": photo_results,
            "cropType": "Out of scope",
            "condition": "Not clear crop leaves",
            "confidenceScore": 0,
            "confidencePercent": 0,
            "status": "Review needed",
            "diagnosisState": "out_of_scope",
            "diagnosisStateLabel": "Out of scope",
            "diagnosisReason": "None of the uploaded photos passed the leaf-image gate.",
            "recommendation": recommendation,
            "recommendationDetails": recommendation_details,
            "predictions": [],
        }

    photo_best_predictions = []
    for photo_result in valid_photo_results:
        best_prediction = max(
            photo_result["predictions"],
            key=lambda prediction: prediction["confidence"],
        )
        photo_best_predictions.append((photo_result, best_prediction))

    class_counts = Counter(
        prediction["className"] for _photo_result, prediction in photo_best_predictions
    )
    winning_class, winning_count = class_counts.most_common(1)[0]
    winning_pairs = [
        (photo_result, prediction)
        for photo_result, prediction in photo_best_predictions
        if prediction["className"] == winning_class
    ]
    best_photo_result, best_prediction = max(
        winning_pairs,
        key=lambda pair: pair[1]["confidence"],
    )
    average_confidence_percent = sum(
        prediction["confidencePercent"] for _photo_result, prediction in winning_pairs
    ) / len(winning_pairs)
    required_agreement = len(valid_photo_results) if len(valid_photo_results) <= 2 else 2
    has_photo_agreement = winning_count >= required_agreement
    all_photos_are_leaf_photos = len(valid_photo_results) == len(photo_results)
    is_confident = (
        has_photo_agreement
        and all_photos_are_leaf_photos
        and average_confidence_percent >= CONFIDENCE_THRESHOLD * 100
    )
    status = "High confidence" if is_confident else "Review needed"

    if is_confident:
        recommendation = best_photo_result["recommendation"]
        recommendation_details = best_photo_result["recommendationDetails"]
        diagnosis_state = {
            "diagnosisState": "confident",
            "diagnosisStateLabel": "Confident multi-photo match",
            "diagnosisReason": (
                f"{winning_count} of {len(valid_photo_results)} leaf photos converge on "
                f"{best_prediction['crop']} - {best_prediction['disease']}."
            ),
        }
        crop_type = best_prediction["crop"]
        condition = best_prediction["disease"]
    else:
        recommendation, recommendation_details = _multi_photo_uncertain_recommendation()
        diagnosis_state = {
            "diagnosisState": "uncertain_need_more_photos",
            "diagnosisStateLabel": "Uncertain multi-photo result",
            "diagnosisReason": (
                f"{winning_count} of {len(valid_photo_results)} leaf photos point to the "
                "same class, which is not stable enough for treatment guidance."
            ),
        }
        crop_type = (
            best_prediction["crop"] if has_photo_agreement else "Multiple possibilities"
        )
        condition = "Needs clearer photo set"

    return {
        "fileName": f"{len(photo_results)} photos",
        "imageSize": photo_results[0].get("imageSize"),
        "leafValidation": {
            "photoCount": len(photo_results),
            "validLeafPhotos": len(valid_photo_results),
            "outOfScopePhotos": len(photo_results) - len(valid_photo_results),
        },
        "photoCount": len(photo_results),
        "photoResults": photo_results,
        "cropType": crop_type,
        "condition": condition,
        "confidenceScore": round(average_confidence_percent / 100, 4),
        "confidencePercent": round(average_confidence_percent, 2),
        "status": status,
        **diagnosis_state,
        "recommendation": recommendation,
        "recommendationDetails": recommendation_details,
        "predictions": tagged_predictions,
    }
