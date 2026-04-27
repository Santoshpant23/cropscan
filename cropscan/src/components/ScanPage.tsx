import type { ChangeEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { diagnosisChatRequest, uploadLeafRequest } from '../lib/api'
import { saveAnalysis } from '../lib/storage'
import type {
  AnalysisRecord,
  DiagnosisChatMessage,
  DiagnosisChatRequest,
  UploadResponse,
} from '../types'

const MAX_CHAT_QUESTIONS = 10
const QUICK_CHAT_PROMPTS = [
  'Give me a 3-day action plan.',
  'How serious is this?',
  'Which supplies matter most?',
  'What should I monitor next?',
]

const PRODUCT_PRIORITY_STYLES = {
  essential: 'bg-[#dcfce7] text-[#166534]',
  helpful: 'bg-[#ffedd5] text-[#9a3412]',
  monitoring: 'bg-[#e0f2fe] text-[#075985]',
}

type CaptureMode = 'upload' | 'camera'

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function buildAnalysisRecordFromResponse(
  response: UploadResponse,
  fileName: string,
  imageDataUrl: string,
  userEmail: string,
): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    userEmail,
    createdAt: new Date().toISOString(),
    fileName,
    imageDataUrl,
    cropType: response.cropType,
    condition: response.condition,
    confidencePercent: response.confidencePercent,
    status: response.status,
    recommendation: response.recommendation,
    recommendationDetails: response.recommendationDetails,
    notes: '',
    predictions: response.predictions.map((prediction) => ({
      modelName: prediction.modelName,
      crop: prediction.crop,
      disease: prediction.disease,
      className: prediction.className,
      confidence: Math.round(prediction.confidencePercent),
      topK: prediction.topK.map((topPrediction) => ({
        className: topPrediction.className,
        crop: topPrediction.crop,
        disease: topPrediction.disease,
        confidence: Math.round(topPrediction.confidencePercent),
      })),
    })),
  }
}

function buildChatRequest(
  record: AnalysisRecord,
  messages: DiagnosisChatMessage[],
  message: string,
): DiagnosisChatRequest {
  return {
    analysis: {
      cropType: record.cropType || record.predictions[0]?.crop || 'Unknown crop',
      condition: record.condition || record.predictions[0]?.disease || 'Unknown condition',
      confidencePercent:
        record.confidencePercent || record.predictions[0]?.confidence || 0,
      status: record.status,
      recommendation: record.recommendation,
      recommendationDetails: record.recommendationDetails || {
        headline: 'Diagnosis guidance',
        urgency: 'medium',
        overview: record.recommendation,
        immediateSteps: [],
        productCategories: [],
        productRecommendations: [],
        cautions: [],
        followUp: 'Monitor the plant and confirm with a local expert if needed.',
      },
      predictions: record.predictions.map((prediction) => ({
        modelName: prediction.modelName,
        crop: prediction.crop,
        disease: prediction.disease,
        className: prediction.className,
        confidencePercent: prediction.confidence,
      })),
    },
    messages,
    message,
  }
}

function ScanPage() {
  const { token, user } = useAuth()
  const isAnalyzeRequestInFlight = useRef(false)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('upload')
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [chatMessages, setChatMessages] = useState<DiagnosisChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [chatError, setChatError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [error, setError] = useState('')
  const usedQuestionCount = chatMessages.filter(
    (message) => message.role === 'user',
  ).length
  const remainingQuestionCount = MAX_CHAT_QUESTIONS - usedQuestionCount
  const hasReachedChatLimit = remainingQuestionCount <= 0
  const isCameraSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [chatMessages, isSendingChat])

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  async function setSelectedImage(file: File) {
    setIsReadingFile(true)
    setLatestRecord(null)
    setError('')
    setCameraError('')
    setChatMessages([])
    setChatInput('')
    setChatError('')
    setSelectedFile(file)
    setFileName(file.name)
    setImageDataUrl(await fileToDataUrl(file))
    setIsReadingFile(false)
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    stopCameraStream()
    await setSelectedImage(file)
  }

  async function handleStartCamera() {
    if (!isCameraSupported || isStartingCamera) {
      return
    }

    setCaptureMode('camera')
    setCameraError('')
    setError('')
    setIsStartingCamera(true)

    try {
      stopCameraStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      })
      cameraStreamRef.current = stream
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        await cameraVideoRef.current.play()
      }
      setIsCameraActive(true)
    } catch (caughtError) {
      setCameraError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Camera access was blocked.',
      )
      stopCameraStream()
    } finally {
      setIsStartingCamera(false)
    }
  }

  async function handleCapturePhoto() {
    if (!cameraVideoRef.current) {
      return
    }

    const video = cameraVideoRef.current
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      setCameraError('The camera is not ready yet. Try again in a moment.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Could not capture a frame from the camera.')
      return
    }

    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) {
      setCameraError('Could not turn the captured image into a file.')
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const capturedFile = new File([blob], `cropscan-capture-${timestamp}.jpg`, {
      type: 'image/jpeg',
    })

    stopCameraStream()
    await setSelectedImage(capturedFile)
  }

  function handleRetakeCameraPhoto() {
    setSelectedFile(null)
    setFileName('')
    setImageDataUrl('')
    setLatestRecord(null)
    setError('')
    setCameraError('')
    setChatMessages([])
    setChatInput('')
    setChatError('')
    void handleStartCamera()
  }

  async function handleAnalyze() {
    if (
      !selectedFile ||
      !imageDataUrl ||
      !fileName ||
      !token ||
      !user ||
      isAnalyzeRequestInFlight.current
    ) {
      return
    }

    isAnalyzeRequestInFlight.current = true
    setIsAnalyzing(true)
    setError('')
    try {
      const response = await uploadLeafRequest(selectedFile, token)
      const record = buildAnalysisRecordFromResponse(
        response,
        fileName,
        imageDataUrl,
        user.email,
      )
      saveAnalysis(record)
      setLatestRecord(record)
      setChatMessages([
        {
          role: 'assistant',
          content:
            'I have the scan result and treatment context ready. Ask me about timing, spread risk, supplies, or what to do next.',
        },
      ])
      setChatInput('')
      setChatError('')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not analyze this image.',
      )
    } finally {
      isAnalyzeRequestInFlight.current = false
      setIsAnalyzing(false)
    }
  }

  async function handleSendChat() {
    const message = chatInput.trim()
    if (
      !message ||
      !latestRecord ||
      !token ||
      isSendingChat ||
      hasReachedChatLimit
    ) {
      return
    }

    const userMessage: DiagnosisChatMessage = { role: 'user', content: message }
    const priorMessages = [...chatMessages]
    const messageHistory = [...priorMessages, userMessage]
    setChatMessages(messageHistory)
    setChatInput('')
    setChatError('')
    setIsSendingChat(true)

    try {
      const response = await diagnosisChatRequest(
        buildChatRequest(latestRecord, priorMessages, message),
        token,
      )
      setChatMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: response.answer },
      ])
    } catch (caughtError) {
      setChatError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not reach the diagnosis assistant.',
      )
    } finally {
      setIsSendingChat(false)
    }
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void handleSendChat()
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="crop-fade-up rounded-lg border border-[#14532d]/10 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase text-[#15803d]">Protected scan</p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">
            Upload a leaf photo
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            EfficientNet-B0 and MobileNetV2 run side by side, then save the
            analysis to your dashboard.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setCaptureMode('upload')
                setCameraError('')
                stopCameraStream()
              }}
              className={`cursor-pointer rounded-md px-4 py-3 text-sm font-black transition ${
                captureMode === 'upload'
                  ? 'bg-[#16351f] text-white'
                  : 'bg-[#f0fdf4] text-[#16351f] ring-1 ring-[#14532d]/10 hover:bg-[#dcfce7]'
              }`}
            >
              Upload image
            </button>
            <button
              type="button"
              onClick={() => {
                void handleStartCamera()
              }}
              disabled={!isCameraSupported || isStartingCamera}
              className={`cursor-pointer rounded-md px-4 py-3 text-sm font-black transition ${
                captureMode === 'camera'
                  ? 'bg-[#16351f] text-white'
                  : 'bg-[#f0fdf4] text-[#16351f] ring-1 ring-[#14532d]/10 hover:bg-[#dcfce7]'
              } disabled:cursor-not-allowed disabled:bg-[#d7dfda] disabled:text-[#708074]`}
            >
              {isStartingCamera ? 'Opening camera...' : 'Use camera'}
            </button>
          </div>

          {captureMode === 'upload' ? (
            <label
              htmlFor="leaf-photo"
            className="relative mt-6 flex min-h-80 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#22c55e]/40 bg-[#f0fdf4] p-4 text-center transition hover:border-[#15803d] hover:bg-[#dcfce7]"
          >
            {imageDataUrl ? (
              <div className="relative w-full">
                <img
                  src={imageDataUrl}
                  alt="Selected leaf preview"
                  className="h-72 w-full rounded-md object-cover sm:h-80"
                />
                {isAnalyzing ? (
                  <div className="crop-scan-overlay flex items-end justify-center p-4">
                    <span className="rounded-full bg-[#16351f]/90 px-3 py-1 text-xs font-black uppercase text-[#bef264]">
                      scanning image
                    </span>
                  </div>
                ) : null}
              </div>
              ) : (
                <span className="max-w-xs">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#16351f] text-xl font-black text-[#bef264]">
                    +
                  </span>
                  <span className="block text-base font-black text-[#16351f]">
                    Choose leaf image
                  </span>
                  <span className="mt-2 block text-sm text-[#4b5d50]">
                    PNG, JPG, or a camera photo from your device
                  </span>
                </span>
              )}
              <input
                id="leaf-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleImageChange}
              />
            </label>
          ) : (
            <div className="mt-6 rounded-lg border border-[#14532d]/10 bg-[#f0fdf4] p-4">
              {imageDataUrl && !isCameraActive ? (
                <div className="relative">
                  <img
                    src={imageDataUrl}
                    alt="Captured leaf preview"
                    className="h-72 w-full rounded-md object-cover sm:h-80"
                  />
                  {isAnalyzing ? (
                    <div className="crop-scan-overlay flex items-end justify-center p-4">
                      <span className="rounded-full bg-[#16351f]/90 px-3 py-1 text-xs font-black uppercase text-[#bef264]">
                        scanning image
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-hidden rounded-md bg-[#d7dfda]">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-72 w-full object-cover sm:h-80"
                  />
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                {isCameraActive ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="w-full cursor-pointer rounded-md bg-[#16351f] px-4 py-3 text-sm font-black text-white transition hover:bg-[#14532d] sm:w-auto"
                    >
                      Capture photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="w-full cursor-pointer rounded-md bg-white px-4 py-3 text-sm font-black text-[#16351f] ring-1 ring-[#14532d]/10 transition hover:bg-[#f8faf8] sm:w-auto"
                    >
                      Close camera
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void handleStartCamera()
                      }}
                      disabled={isStartingCamera || !isCameraSupported}
                      className="w-full cursor-pointer rounded-md bg-[#16351f] px-4 py-3 text-sm font-black text-white transition hover:bg-[#14532d] sm:w-auto disabled:cursor-not-allowed disabled:bg-[#708074]"
                    >
                      {isStartingCamera ? 'Opening camera...' : 'Open camera'}
                    </button>
                    {imageDataUrl ? (
                      <button
                        type="button"
                        onClick={handleRetakeCameraPhoto}
                        className="w-full cursor-pointer rounded-md bg-white px-4 py-3 text-sm font-black text-[#16351f] ring-1 ring-[#14532d]/10 transition hover:bg-[#f8faf8] sm:w-auto"
                      >
                        Retake photo
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}

          {fileName && (
            <p className="mt-3 truncate text-sm font-bold text-[#4b5d50]">
              Selected: {fileName}
            </p>
          )}

          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            Best results come from one leaf, bright lighting, and a simple background.
          </p>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!imageDataUrl || isReadingFile || isAnalyzing}
            className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-[#f97316]/20 disabled:cursor-not-allowed disabled:bg-[#a8b3aa] disabled:shadow-none disabled:hover:translate-y-0"
          >
            {isAnalyzing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Analyzing leaf...
              </>
            ) : (
              'Run both models'
            )}
          </button>

          {cameraError && (
            <p className="mt-4 rounded-md bg-[#eff6ff] px-4 py-3 text-sm font-bold text-[#1d4ed8] ring-1 ring-[#bfdbfe]">
              {cameraError}
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#be123c] ring-1 ring-[#fecdd3]">
              {error}
            </p>
          )}
        </div>

        <div className="crop-fade-up rounded-lg bg-[#16351f] p-5 text-white shadow-sm sm:p-6">
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

          {!latestRecord && isAnalyzing ? (
            <div className="mt-8 space-y-5">
              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <div className="h-4 w-32 animate-pulse rounded bg-white/20" />
                <div className="mt-4 h-8 w-64 animate-pulse rounded bg-white/20" />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="h-36 animate-pulse rounded-lg bg-white/90" />
                  <div className="h-36 animate-pulse rounded-lg bg-white/90" />
                </div>
                <div className="mt-5 h-4 w-full animate-pulse rounded bg-white/20" />
                <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-white/20" />
              </div>
              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <div className="flex items-center gap-2 text-sm font-black text-[#bef264]">
                  <span className="h-2 w-2 rounded-full bg-[#bef264]" />
                  Running leaf validation, two models, and guidance generation
                </div>
              </div>
            </div>
          ) : !latestRecord ? (
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
                  {(latestRecord.cropType || latestRecord.predictions[0].crop) +
                    ' - ' +
                    (latestRecord.condition || latestRecord.predictions[0].disease)}
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
                    {prediction.topK && (
                      <div className="mt-4 space-y-2 border-t border-[#14532d]/10 pt-3">
                        {prediction.topK.slice(0, 3).map((topPrediction) => (
                          <p
                            key={`${prediction.modelName}-${topPrediction.className}`}
                            className="flex justify-between gap-3 text-xs font-bold text-[#4b5d50]"
                          >
                            <span>{topPrediction.disease}</span>
                            <span>{topPrediction.confidence}%</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-black text-[#bef264]">
                      {latestRecord.recommendationDetails?.headline || 'Recommendation'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#ecfdf5]">
                      {latestRecord.recommendationDetails?.overview ||
                        latestRecord.recommendation}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${
                      latestRecord.recommendationDetails?.urgency === 'high'
                        ? 'bg-[#fecaca] text-[#7f1d1d]'
                        : latestRecord.recommendationDetails?.urgency === 'low'
                          ? 'bg-[#dcfce7] text-[#166534]'
                          : 'bg-[#fed7aa] text-[#9a3412]'
                    }`}
                  >
                    {latestRecord.recommendationDetails?.urgency || 'medium'} urgency
                  </span>
                </div>

                {latestRecord.recommendationDetails?.immediateSteps?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-[#bef264]">
                      Immediate steps
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-[#ecfdf5]">
                      {latestRecord.recommendationDetails.immediateSteps.map((step) => (
                        <li key={step} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-[#bef264]" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestRecord.recommendationDetails?.productCategories?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-[#bef264]">
                      Product categories to consider
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latestRecord.recommendationDetails.productCategories.map(
                        (category) => (
                          <span
                            key={category}
                            className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#ecfdf5] ring-1 ring-white/10"
                          >
                            {category}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                {latestRecord.recommendationDetails?.productRecommendations?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-[#bef264]">
                      Supply plan
                    </h4>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {latestRecord.recommendationDetails.productRecommendations.map(
                        (product) => (
                          <article
                            key={`${product.category}-${product.title}`}
                            className="rounded-lg border border-white/10 bg-white p-4 text-[#16351f] shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-black uppercase text-[#15803d]">
                                  {product.category}
                                </p>
                                <h5 className="mt-1 text-sm font-black">
                                  {product.title}
                                </h5>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                                  PRODUCT_PRIORITY_STYLES[product.priority]
                                }`}
                              >
                                {product.priority}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
                              {product.useCase}
                            </p>
                            <div className="mt-3 space-y-2 border-t border-[#14532d]/10 pt-3 text-xs font-bold text-[#4b5d50]">
                              <p>Timing: {product.timing}</p>
                              <p>Buyer's note: {product.buyerNote}</p>
                              <p className="text-[#9a3412]">{product.caution}</p>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase text-[#d1fae5]">
                      Category-level suggestions only. Confirm labels before purchase
                      or application.
                    </p>
                  </div>
                ) : null}

                {latestRecord.recommendationDetails?.cautions?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-[#bef264]">
                      Cautions
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-[#ecfdf5]">
                      {latestRecord.recommendationDetails.cautions.map((caution) => (
                        <li key={caution} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-[#f97316]" />
                          <span>{caution}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-5 text-sm font-bold text-[#d1fae5]">
                  {latestRecord.recommendationDetails?.followUp ||
                    latestRecord.recommendation}
                </p>
              </div>

              <div className="crop-fade-up rounded-lg border border-white/15 bg-[#f8faf8] p-4 text-[#16351f] shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 border-b border-[#14532d]/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-[#16351f]">
                      CropScan chat
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#4b5d50]">
                      Follow up on timing, spread risk, supplies, or next steps.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-[#4b5d50] ring-1 ring-[#14532d]/10">
                      {usedQuestionCount}/{MAX_CHAT_QUESTIONS} used
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                        hasReachedChatLimit
                          ? 'bg-[#fecaca] text-[#7f1d1d]'
                          : 'bg-[#dcfce7] text-[#166534]'
                      }`}
                    >
                      {hasReachedChatLimit
                        ? 'Limit reached'
                        : `${remainingQuestionCount} left`}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {QUICK_CHAT_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setChatInput(prompt)}
                      disabled={!latestRecord || hasReachedChatLimit || isSendingChat}
                      className="cursor-pointer rounded-full bg-white px-3 py-2 text-xs font-bold text-[#16351f] ring-1 ring-[#14532d]/10 transition hover:-translate-y-0.5 hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:bg-[#eef3ef] disabled:text-[#8aa194] disabled:hover:translate-y-0"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="crop-chat-scroll mt-5 max-h-[520px] min-h-[320px] space-y-5 overflow-y-auto rounded-lg border border-[#14532d]/10 bg-white p-3 sm:p-4">
                  {chatMessages.length ? (
                    chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`flex gap-3 ${
                          message.role === 'assistant' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#16351f] text-xs font-black text-[#bef264]">
                            CS
                          </div>
                        ) : null}
                        <div
                          className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[78%] ${
                            message.role === 'assistant'
                              ? 'border border-[#14532d]/10 bg-[#f4fbf7] text-[#16351f]'
                              : 'bg-[#16351f] text-white'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === 'user' ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f97316] text-xs font-black text-white">
                            You
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-[#14532d]/10 bg-[#f4fbf7] px-4 py-4 text-sm text-[#4b5d50]">
                      Run a scan first, then ask follow-up questions here.
                    </div>
                  )}
                  {isSendingChat ? (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#16351f] text-xs font-black text-[#bef264]">
                        CS
                      </div>
                      <div className="rounded-lg border border-[#14532d]/10 bg-[#f4fbf7] px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-[#15803d]" />
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-[#15803d]" />
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-[#15803d]" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>

                <div className="mt-4 rounded-lg border border-[#14532d]/10 bg-white p-3 shadow-sm">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    rows={3}
                    maxLength={1500}
                    placeholder="Ask a follow-up..."
                    disabled={!latestRecord || hasReachedChatLimit}
                    className="max-h-48 min-h-24 w-full resize-y rounded-md border-0 bg-transparent px-2 py-2 text-sm text-[#16351f] outline-none ring-0 placeholder:text-[#6b7a6e] disabled:cursor-not-allowed disabled:bg-[#f3f6f4]"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {chatError ? (
                      <p className="text-sm font-bold text-[#be123c]">{chatError}</p>
                    ) : hasReachedChatLimit ? (
                      <p className="text-sm font-bold text-[#9a3412]">
                        You have reached the 10-question limit for this scan.
                      </p>
                    ) : (
                      <p className="text-xs font-bold uppercase text-[#6b7a6e]">
                        Enter sends, Shift+Enter adds a new line
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#6b7a6e]">
                        {chatInput.length}/1500
                      </span>
                      <button
                        type="button"
                        onClick={handleSendChat}
                        disabled={
                          !latestRecord ||
                          !chatInput.trim() ||
                          isSendingChat ||
                          hasReachedChatLimit
                        }
                        className="w-full cursor-pointer rounded-md bg-[#16351f] px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#14532d] sm:w-auto disabled:cursor-not-allowed disabled:bg-[#b2c0b6] disabled:hover:translate-y-0"
                      >
                        {isSendingChat ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default ScanPage
