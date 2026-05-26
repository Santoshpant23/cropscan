FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.docker.txt .

RUN pip install --no-cache-dir -r requirements.docker.txt \
    && pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        torch==2.5.1 torchvision==0.20.1 \
    && pip install --no-cache-dir timm==1.0.11

# Pre-cache every set of pretrained weights the app loads at runtime so a
# fresh container never has to reach the network on first request:
#  - DINOv2 ViT-S/14 backbone (v5 disease classifier, via torch.hub)
#  - MobileNetV2 ImageNet weights (leaf-detector gate in inference.py)
#  - timm DINOv2 ViT-S/14 (walk-scan model in walk_inference.py)
RUN python -c "import torch; torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14', skip_validation=True)" \
    && python -c "from torchvision import models; models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V2)" \
    && python -c "import timm; timm.create_model('vit_small_patch14_dinov2.lvd142m', pretrained=True)"

COPY app ./app
COPY models ./models
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
