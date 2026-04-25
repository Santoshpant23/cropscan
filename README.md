# Crop Scan

> Instant AI-powered crop disease detection from a single photo.

Crop Scan is a web application built for smallholder farmers, backyard gardeners, and agricultural staff who need fast, reliable plant disease diagnosis without access to an agronomist. Upload a photo of a leaf and get an instant prediction, confidence score, and plain-language treatment recommendation.

**Team Cultivate** — Aisha Noor, Dipsha Budhathoki, Santosh Pant, Nima Sherpa

---

## Features

- Leaf image upload with instant disease classification
- Dual-model ensemble (EfficientNet-B0 + MobileNetV2) for higher reliability
- Confidence threshold: results flagged as "Review needed" when below 70%
- Plain-language treatment recommendations for 15 crop/disease classes
- JWT-based user authentication (signup, login, profile management)
- Protected scan and dashboard routes

## Supported Crops & Conditions

| Crop | Conditions |
|------|-----------|
| Pepper (Bell) | Bacterial Spot, Healthy |
| Potato | Early Blight, Late Blight, Healthy |
| Tomato | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria Leaf Spot, Spider Mites, Target Spot, Yellow Leaf Curl Virus, Mosaic Virus, Healthy |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite, React Router v7 |
| Backend | FastAPI (Python), MongoDB (PyMongo), JWT (PyJWT + Argon2) |
| ML | PyTorch, torchvision — EfficientNet-B0 & MobileNetV2 trained on PlantVillage |
| Hosting | Vercel (frontend), Render (backend) |

---

## Project Structure

```
cropscan/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── config.py     # Pydantic settings (reads .env)
│   │   ├── database.py   # MongoDB connection & indexes
│   │   ├── dependencies.py # JWT auth dependency
│   │   ├── inference.py  # Model loading & prediction logic
│   │   ├── main.py       # FastAPI app factory
│   │   ├── models.py     # Pydantic request/response schemas
│   │   ├── routes.py     # Auth routes (/auth/*)
│   │   ├── security.py   # Password hashing & token creation
│   │   └── upload_routes.py # Prediction endpoint (/upload)
│   ├── models/           # Trained .pth model weights (git-ignored)
│   ├── tests/            # Pytest test suite
│   ├── requirements.txt
│   └── .env.example
├── cropscan/             # React frontend
│   ├── src/
│   │   ├── components/   # Page & UI components
│   │   ├── context/      # AuthContext + auth state
│   │   ├── lib/          # API client, form helpers, storage
│   │   └── types.ts      # Shared TypeScript types
│   ├── package.json
│   └── .env.example
└── notebooks/            # Training notebooks (cropscan.ipynb)
```

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- MongoDB Atlas cluster (or local MongoDB)

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URL and JWT secret

# Start the server
uvicorn app.main:app --reload
# API available at http://127.0.0.1:8000
# Docs at http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd cropscan

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local if your backend runs on a different port

# Start dev server
npm run dev
# App available at http://localhost:5173
```

### Environment Variables

**Backend (`backend/.env`)**

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URL` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | No | Database name (default: `cropscan`) |
| `JWT_SECRET_KEY` | Yes | Long random secret for signing tokens |
| `JWT_ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token TTL in minutes (default: `60`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `MODEL_DIR` | No | Path to `.pth` weight files (default: `models/`) |
| `SKIP_DB_INIT` | No | Skip MongoDB index creation on startup (useful for tests) |

**Frontend (`cropscan/.env.local`)**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000/api/v1` | Backend base URL |

---

## API Reference

Base path: `/api/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/auth/signup` | No | Create account |
| `POST` | `/auth/login` | No | Login, returns JWT |
| `GET` | `/auth/me` | Yes | Get current user profile |
| `PATCH` | `/auth/me` | Yes | Update profile |
| `POST` | `/auth/change-password` | Yes | Change password |
| `POST` | `/upload` | Yes | Upload leaf image → prediction |

### Prediction Response

```json
{
  "fileName": "leaf.jpg",
  "cropType": "Tomato",
  "condition": "Early Blight",
  "confidenceScore": 0.9241,
  "confidencePercent": 92.41,
  "status": "High confidence",
  "recommendation": "Remove lower infected leaves...",
  "predictions": [
    {
      "modelName": "EfficientNet-B0",
      "className": "Tomato_Early_blight",
      "crop": "Tomato",
      "disease": "Early Blight",
      "confidence": 0.9241,
      "confident": true,
      "topK": [...]
    },
    ...
  ]
}
```

`status` is `"High confidence"` when both models agree and both exceed 70% confidence; otherwise `"Review needed"`.

---

## Running Tests

```bash
cd backend
pytest
```

---

## Model Weights

The trained `.pth` files are not included in this repository due to file size. Place them in `backend/models/`:

- `efficientnet_b0_cropscan.pth`
- `mobilenetv2_cropscan.pth`

Both models are fine-tuned on the [PlantVillage dataset](https://www.kaggle.com/datasets/emmarex/plantdisease) using transfer learning with a custom 15-class classifier head.

---

## License

This project was developed as an academic course project by Team Cultivate.
