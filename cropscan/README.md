# CropScan Frontend

React + Vite frontend for CropScan.

For full project setup, backend configuration, and required Python version, see the root `README.md`.

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

Create a local `cropscan/.env` file from `.env.example`. Do not rely on global system environment variables for frontend configuration.

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

## Notes

- The frontend expects the backend to be running before login, signup, or image upload will work.
- The main authenticated routes are `/scan`, `/dashboard`, and `/profile`.
