from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image
import torch
from torch import nn
from torchvision import models, transforms

from app.config import get_settings

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
        transforms.Resize(256),
        transforms.CenterCrop(224),
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


def _build_efficientnet_b0() -> nn.Module:
    model = models.efficientnet_b0(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.classifier[1].in_features, len(CLASS_NAMES)),
    )
    return model


def _build_mobilenet_v2() -> nn.Module:
    model = models.mobilenet_v2(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
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
            "EfficientNet-B0": _load_state_dict(
                _build_efficientnet_b0(),
                _model_path("efficientnet_b0_cropscan.pth"),
                device,
            ),
            "MobileNetV2": _load_state_dict(
                _build_mobilenet_v2(),
                _model_path("mobilenetv2_cropscan.pth"),
                device,
            ),
        },
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
    pixels = list(resized.getdata())
    green_pixels = sum(
        1
        for red, green, blue in pixels
        if green > 60 and green > red * 1.12 and green > blue * 1.08
    )
    return green_pixels / len(pixels)


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


def _predict_model(model: nn.Module, model_name: str, image_tensor: torch.Tensor) -> dict:
    with torch.no_grad():
        probabilities = torch.softmax(model(image_tensor), dim=1)[0]
    top_probabilities, top_indices = torch.topk(probabilities, k=3)
    top_k = [
        _prediction_from_index(int(index), float(probability))
        for probability, index in zip(top_probabilities.cpu(), top_indices.cpu())
    ]
    top_prediction = top_k[0]
    return {
        "modelName": model_name,
        **top_prediction,
        "confident": top_prediction["confidence"] >= CONFIDENCE_THRESHOLD,
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


def predict_leaf_image(image_bytes: bytes, filename: str) -> dict:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    bundle = get_model_bundle()
    leaf_validation = _detect_leaf_image(bundle, image)
    if not leaf_validation["isLeaf"]:
        raise ValueError(
            "This image does not appear to be a clear leaf photo. Upload a close-up "
            "image of one leaf in good lighting."
        )

    device = bundle["device"]
    image_tensor = IMAGE_TRANSFORM(image).unsqueeze(0).to(device)

    predictions = [
        _predict_model(model, model_name, image_tensor)
        for model_name, model in bundle["models"].items()
    ]
    same_top_class = len({prediction["className"] for prediction in predictions}) == 1
    all_confident = all(prediction["confident"] for prediction in predictions)
    status = "High confidence" if same_top_class and all_confident else "Review needed"

    best_prediction = max(predictions, key=lambda prediction: prediction["confidence"])
    return {
        "fileName": filename,
        "imageSize": {"width": image.width, "height": image.height},
        "leafValidation": leaf_validation,
        "cropType": best_prediction["crop"],
        "condition": best_prediction["disease"],
        "confidenceScore": best_prediction["confidence"],
        "confidencePercent": best_prediction["confidencePercent"],
        "status": status,
        "recommendation": _recommendation_for(predictions, status),
        "predictions": predictions,
    }
