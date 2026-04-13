import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { saveAnalysis } from '../lib/storage'
import type { AnalysisRecord, ModelPrediction } from '../types'

type MockCase = {
  crop: string
  disease: string
  efficientNetConfidence: number
  mobileNetConfidence: number
  recommendation: string
}

const mockCases: MockCase[] = [
  {
    crop: 'Tomato',
    disease: 'Late Blight',
    efficientNetConfidence: 94,
    mobileNetConfidence: 91,
    recommendation:
      'Remove heavily infected leaves, avoid overhead watering, and separate affected plants when possible. Confirm with a local extension office before applying treatment.',
  },
  {
    crop: 'Potato',
    disease: 'Early Blight',
    efficientNetConfidence: 88,
    mobileNetConfidence: 84,
    recommendation:
      'Prune infected foliage, improve airflow, and avoid splashing soil onto leaves. A labeled fungicide may be appropriate if symptoms keep spreading.',
  },
  {
    crop: 'Grape',
    disease: 'Black Rot',
    efficientNetConfidence: 81,
    mobileNetConfidence: 76,
    recommendation:
      'Remove diseased leaves and old fruit mummies from the vine area. Keep vines open for airflow and ask an extension agent about local spray timing.',
  },
  {
    crop: 'Pepper',
    disease: 'Bacterial Spot',
    efficientNetConfidence: 69,
    mobileNetConfidence: 64,
    recommendation:
      'The models are below the confidence threshold. Retake the photo in bright light with one main leaf, then confirm with expert review before treatment.',
  },
]

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function buildAnalysisRecord(
  fileName: string,
  imageDataUrl: string,
  userEmail: string,
): AnalysisRecord {
  const selectedCase = mockCases[fileName.length % mockCases.length]
  const predictions: ModelPrediction[] = [
    {
      modelName: 'EfficientNet-B0',
      crop: selectedCase.crop,
      disease: selectedCase.disease,
      confidence: selectedCase.efficientNetConfidence,
    },
    {
      modelName: 'MobileNetV2',
      crop: selectedCase.crop,
      disease: selectedCase.disease,
      confidence: selectedCase.mobileNetConfidence,
    },
  ]
  const status =
    predictions.every((prediction) => prediction.confidence >= 70) &&
    predictions.every((prediction) => prediction.disease === predictions[0].disease)
      ? 'High confidence'
      : 'Review needed'

  return {
    id: crypto.randomUUID(),
    userEmail,
    createdAt: new Date().toISOString(),
    fileName,
    imageDataUrl,
    status,
    recommendation: selectedCase.recommendation,
    notes: '',
    predictions,
  }
}

function ScanPage() {
  const { user } = useAuth()
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingFile(true)
    setLatestRecord(null)
    setFileName(file.name)
    setImageDataUrl(await fileToDataUrl(file))
    setIsReadingFile(false)
  }

  function handleAnalyze() {
    if (!imageDataUrl || !fileName || !user) return

    // Replace this mock record with a FastAPI image upload when the backend is ready.
    const record = buildAnalysisRecord(fileName, imageDataUrl, user.email)
    saveAnalysis(record)
    setLatestRecord(record)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-[#14532d]/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase text-[#15803d]">Protected scan</p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">
            Upload a leaf photo
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            EfficientNet-B0 and MobileNetV2 run side by side, then save the
            analysis to your dashboard.
          </p>

          <label
            htmlFor="leaf-photo"
            className="mt-6 flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#22c55e]/40 bg-[#f0fdf4] p-4 text-center transition hover:border-[#15803d] hover:bg-[#dcfce7]"
          >
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="Selected leaf preview"
                className="h-72 w-full rounded-md object-cover"
              />
            ) : (
              <span className="max-w-xs">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#16351f] text-xl font-black text-[#bef264]">
                  +
                </span>
                <span className="block text-base font-black text-[#16351f]">
                  Choose leaf image
                </span>
                <span className="mt-2 block text-sm text-[#4b5d50]">
                  PNG, JPG, or camera photo
                </span>
              </span>
            )}
            <input
              id="leaf-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageChange}
            />
          </label>

          {fileName && (
            <p className="mt-3 truncate text-sm font-bold text-[#4b5d50]">
              Selected: {fileName}
            </p>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!imageDataUrl || isReadingFile}
            className="mt-5 w-full cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#a8b3aa]"
          >
            Run both models
          </button>
        </div>

        <div className="rounded-lg bg-[#16351f] p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-[#bef264]">
                Model comparison
              </p>
              <h2 className="mt-2 text-3xl font-black">Diagnosis result</h2>
            </div>
            <Link
              to="/dashboard"
              className="rounded-md bg-white/10 px-4 py-2 text-center text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              View history
            </Link>
          </div>

          {!latestRecord ? (
            <div className="mt-8 rounded-lg border border-white/15 bg-white/8 p-6">
              <p className="text-lg font-black text-white">No result yet</p>
              <p className="mt-2 text-sm leading-6 text-[#d1fae5]">
                Upload a clear image and run both models. The completed analysis will
                appear here and will be saved automatically.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div
                className={`rounded-lg p-4 ${
                  latestRecord.status === 'High confidence'
                    ? 'bg-[#bef264] text-[#16351f]'
                    : 'bg-[#fed7aa] text-[#7c2d12]'
                }`}
              >
                <p className="text-sm font-black uppercase">{latestRecord.status}</p>
                <p className="mt-1 text-2xl font-black">
                  {latestRecord.predictions[0].crop} - {latestRecord.predictions[0].disease}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {latestRecord.predictions.map((prediction) => (
                  <div
                    key={prediction.modelName}
                    className="rounded-lg border border-white/15 bg-white p-5 text-[#16351f]"
                  >
                    <p className="text-sm font-black text-[#15803d]">
                      {prediction.modelName}
                    </p>
                    <p className="mt-3 text-3xl font-black">
                      {prediction.confidence}%
                    </p>
                    <p className="mt-2 text-sm font-bold text-[#4b5d50]">
                      {prediction.crop} - {prediction.disease}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <h3 className="font-black text-[#bef264]">Recommendation</h3>
                <p className="mt-2 text-sm leading-6 text-[#ecfdf5]">
                  {latestRecord.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default ScanPage
