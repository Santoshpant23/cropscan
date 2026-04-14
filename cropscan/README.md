# CropScan Frontend

React + Vite frontend for CropScan.

## Setup

```bash
cd cropscan
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell:

```powershell
cd cropscan
npm install
Copy-Item .env.example .env
npm run dev
```

## Environment

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Routes

- `/` public landing page
- `/login`
- `/signup`
- `/scan` protected image upload and model comparison
- `/dashboard` protected saved analysis history
- `/profile` protected profile editing

## Checks

```bash
npm run lint
npm run build
```
