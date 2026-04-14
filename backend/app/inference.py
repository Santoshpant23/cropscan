from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image
import torch
from torch import nn
from torchvision import models, transforms

from app.config import get_settings

CLASS_NAMES = [
    "Pepper__bell___Bacterial_spot",
    "Pepper__bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
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
BACKEND_ROOT = Path(__file__).resolve().parents[1]

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
    "Early Blight": "Remove lower infected leaves, improve airflow, and keep soil from splashing onto foliage. Consider labeled fungicide guidance if spread continues.",
    "Late Blight": "Separate affected plants where possible, remove heavily infected foliage, and avoid overhead watering. Contact a local extension office quickly because late blight can spread fast.",
    "Leaf Mold": "Increase airflow, reduce leaf wetness, and remove badly infected leaves. Greenhouse or dense plantings may need humidity control.",
    "Septoria Leaf Spot": "Remove spotted leaves, mulch to reduce soil splash, and avoid working plants when wet. Use local extension guidance before treatment.",
    "Spider Mites Two Spotted Spider Mite": "Check leaf undersides for mites, rinse foliage with water, and reduce plant stress. Severe cases may need a labeled miticide or expert guidance.",
    "Target Spot": "Remove affected leaves and improve airflow around plants. Avoid overhead watering and monitor nearby plants for new lesions.",
    "Tomato Yellow Leaf Curl Virus": "Remove severely affected plants and control whiteflies with locally recommended methods. Do not compost infected plants.",
    "Tomato Mosaic Virus": "Remove infected plants, wash hands and tools, and avoid handling healthy plants after touching symptomatic leaves.",
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


def _load_state_dict(model: nn.Module, path: Path, device: torch.device) -> nn.Module:
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")
    state_dict = torch.load(path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model


@lru_cache
def get_model_bundle() -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return {
        "device": device,
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


def _class_to_crop(class_name: str) -> str:
    if class_name.startswith("Pepper"):
        return "Pepper"
    if class_name.startswith("Potato"):
        return "Potato"
    return "Tomato"


def _class_to_disease(class_name: str) -> str:
    if "healthy" in class_name.lower():
        return "Healthy"
    disease = class_name
    for prefix in [
        "Pepper__bell___",
        "Potato___",
        "Tomato__Tomato_",
        "Tomato__",
        "Tomato_",
    ]:
        disease = disease.replace(prefix, "")
    return disease.replace("_", " ").strip().title()


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
        "cropType": best_prediction["crop"],
        "condition": best_prediction["disease"],
        "confidenceScore": best_prediction["confidence"],
        "confidencePercent": best_prediction["confidencePercent"],
        "status": status,
        "recommendation": _recommendation_for(predictions, status),
        "predictions": predictions,
    }
