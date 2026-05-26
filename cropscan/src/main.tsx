import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTextScale, getSavedTextScaleId } from './lib/textScale'

// Apply the saved text-size preference before first paint.
applyTextScale(getSavedTextScaleId())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
