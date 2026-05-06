import type { ChangeEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  History,
  Leaf,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  diagnosisChatRequest,
  getPlotsRequest,
  saveScanRequest,
  uploadLeafRequest,
} from '../lib/api'
import { saveAnalysis } from '../lib/storage'
import HelpTip from './HelpTip'
import type {
  AnalysisRecord,
  DiagnosisChatMessage,
  DiagnosisChatRequest,
  PlotRecord,
  UploadResponse,
} from '../types'

const MAX_CHAT_QUESTIONS = 10
const WALK_HANDOFF_KEY = 'cropscan_walk_handoff'
const QUICK_CHAT_PROMPTS = [
  'Give me a 3-day action plan.',
  'How serious is this?',
  'Which supplies matter most?',
  'What should I monitor next?',
]

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, encoded] = dataUrl.split(',')
  const mimeMatch = meta.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(encoded)
  const buffer = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    buffer[index] = binary.charCodeAt(index)
  }
  return new File([buffer], fileName, { type: mime })
}

const PRODUCT_PRIORITY_STYLES = {
  essential: 'bg-leaf-300/30 text-leaf-700',
  helpful: 'bg-orange-100 text-sun-orange',
  monitoring: 'bg-blue-100 text-blue-700',
}

type CaptureMode = 'upload' | 'camera'

function distanceMeters(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
) {
  const earthRadiusMeters = 6371000
  const toRadians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = toRadians(secondLatitude - firstLatitude)
  const longitudeDelta = toRadians(secondLongitude - firstLongitude)
  const firstLatRadians = toRadians(firstLatitude)
  const secondLatRadians = toRadians(secondLatitude)
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(firstLatRadians) *
      Math.cos(secondLatRadians) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function nearestPlotForPosition(
  plots: PlotRecord[],
  latitude: number,
  longitude: number,
) {
  const candidates = plots
    .map((plot) => ({
      plot,
      distance: distanceMeters(latitude, longitude, plot.latitude, plot.longitude),
    }))
    .filter((candidate) => candidate.distance <= 100)
    .sort((first, second) => first.distance - second.distance)
  return candidates[0]?.plot
}

function friendlyStatus(record: AnalysisRecord) {
  if (record.diagnosisState === 'out_of_scope') return 'Needs a clearer photo'
  if (record.diagnosisState === 'uncertain_need_more_photos') return 'Try one more angle'
  if (record.status === 'High confidence') return 'Looks good'
  return 'Needs another look'
}

const ANALYZING_STEPS = [
  { label: 'Identifying species', icon: Leaf },
  { label: 'Pathogen scan', icon: ShieldCheck },
  { label: 'Confidence level', icon: Sparkles },
]

function friendlyReasonLabel(record: AnalysisRecord) {
  if (record.diagnosisState === 'out_of_scope') return 'Scan quality'
  if (record.diagnosisState === 'uncertain_need_more_photos') return 'Not sure yet'
  return 'Scan check'
}

function imageToThumbnailDataUrl(file: File, maxSize = 900, quality = 0.76) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not prepare image preview.'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image.'))
    }

    image.src = objectUrl
  })
}

function buildAnalysisRecordFromResponse(
  response: UploadResponse,
  fileName: string,
  imageDataUrl: string,
  photoDataUrls: string[],
  userEmail: string,
  plot?: PlotRecord,
): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    userEmail,
    predictionToken: response.predictionToken,
    createdAt: new Date().toISOString(),
    fileName,
    imageDataUrl,
    photoDataUrls,
    photoCount: response.photoCount || photoDataUrls.length || 1,
    plotId: plot?.id,
    plotName: plot?.name,
    scanLocationLabel: plot?.locationLabel,
    cropType: response.cropType,
    condition: response.condition,
    confidencePercent: response.confidencePercent,
    status: response.status,
    diagnosisState: response.diagnosisState,
    diagnosisStateLabel: response.diagnosisStateLabel,
    diagnosisReason: response.diagnosisReason,
    recommendation: response.recommendation,
    recommendationDetails: response.recommendationDetails,
    notes: '',
    photoResults: response.photoResults,
    predictions: response.predictions.map((prediction) => ({
      modelName: prediction.modelName,
      crop: prediction.crop,
      disease: prediction.disease,
      className: prediction.className,
      confidenceMargin: prediction.confidenceMargin,
      entropy: prediction.entropy,
      temperature: prediction.temperature,
      thresholds: prediction.thresholds,
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null)
  const [plots, setPlots] = useState<PlotRecord[]>([])
  const [selectedPlotId, setSelectedPlotId] = useState('')
  const [autoPlotNotice, setAutoPlotNotice] = useState('')
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
  const [scanNotice, setScanNotice] = useState('')
  const usedQuestionCount = chatMessages.filter(
    (message) => message.role === 'user',
  ).length
  const remainingQuestionCount = MAX_CHAT_QUESTIONS - usedQuestionCount
  const hasReachedChatLimit = remainingQuestionCount <= 0
  const isLatestRecordOutOfScope = latestRecord?.diagnosisState === 'out_of_scope'
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
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(WALK_HANDOFF_KEY)
    if (!raw) return
    window.sessionStorage.removeItem(WALK_HANDOFF_KEY)
    try {
      const parsed = JSON.parse(raw) as {
        dataUrl?: string
        sourceTimestampMs?: number
      }
      if (!parsed.dataUrl) return
      const file = dataUrlToFile(
        parsed.dataUrl,
        `walk-frame-${Math.round(parsed.sourceTimestampMs ?? 0)}ms.jpg`,
      )
      void setSelectedImages([file])
    } catch {
      // ignore malformed handoff payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [chatMessages, isSendingChat])

  useEffect(() => {
    if (!token) return

    const activeToken = token
    let isMounted = true
    async function loadPlots() {
      try {
        const serverPlots = await getPlotsRequest(activeToken)
        if (!isMounted) return
        setPlots(serverPlots)
        if (serverPlots.length === 1) {
          setSelectedPlotId(serverPlots[0].id)
        }
      } catch {
        if (isMounted) setPlots([])
      }
    }

    void loadPlots()

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (!plots.length || selectedPlotId || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestPlot = nearestPlotForPosition(
          plots,
          position.coords.latitude,
          position.coords.longitude,
        )
        if (!nearestPlot) return
        setSelectedPlotId(nearestPlot.id)
        setAutoPlotNotice(`Nearby spot found: ${nearestPlot.name}`)
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }, [plots, selectedPlotId])

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

  function clearSelectedScanState() {
    setSelectedFile(null)
    setSelectedFiles([])
    setFileName('')
    setImageDataUrl('')
    setImageDataUrls([])
    setLatestRecord(null)
    setChatMessages([])
    setChatInput('')
    setChatError('')
    setScanNotice('')
  }

  async function setSelectedImages(files: File[]) {
    const nextFiles = files.slice(0, 3)
    if (!nextFiles.length) return

    setIsReadingFile(true)
    clearSelectedScanState()
    setError('')
    setCameraError('')
    setSelectedFile(nextFiles[0])
    setSelectedFiles(nextFiles)
    setFileName(
      nextFiles.length === 1
        ? nextFiles[0].name
        : `${nextFiles.length} photos selected`,
    )
    try {
      const dataUrls = await Promise.all(
        nextFiles.map((file) => imageToThumbnailDataUrl(file)),
      )
      setImageDataUrl(dataUrls[0])
      setImageDataUrls(dataUrls)
    } finally {
      setIsReadingFile(false)
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 3)
    if (!files.length) return

    stopCameraStream()
    await setSelectedImages(files)
  }

  async function handleStartCamera() {
    if (!isCameraSupported || isStartingCamera || isAnalyzing) {
      return
    }

    stopCameraStream()
    clearSelectedScanState()
    setCaptureMode('camera')
    setCameraError('')
    setError('')
    setIsStartingCamera(true)

    try {
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

    const nextFiles = [...selectedFiles, capturedFile].slice(0, 3)
    await setSelectedImages(nextFiles)
    if (nextFiles.length >= 3) {
      stopCameraStream()
    }
  }

  async function handleRemoveSelectedPhoto(index: number) {
    if (isAnalyzing) return

    const nextFiles = selectedFiles.filter((_file, fileIndex) => fileIndex !== index)
    if (!nextFiles.length) {
      clearSelectedScanState()
      return
    }

    await setSelectedImages(nextFiles)
  }

  function handleRetakeCameraPhoto() {
    clearSelectedScanState()
    setError('')
    setCameraError('')
    void handleStartCamera()
  }

  async function handleAnalyze() {
    if (
      !selectedFile ||
      selectedFiles.length === 0 ||
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
    setScanNotice('')
    try {
      const selectedPlot = plots.find((plot) => plot.id === selectedPlotId)
      const isBatchUpload = captureMode === 'upload' && selectedFiles.length > 1

      if (isBatchUpload) {
        const savedRecords: AnalysisRecord[] = []
        let failedHistorySaves = 0

        for (const [index, file] of selectedFiles.entries()) {
          const preview = imageDataUrls[index] || (await imageToThumbnailDataUrl(file))
          const response = await uploadLeafRequest(file, token)
          const localRecord = buildAnalysisRecordFromResponse(
            response,
            file.name,
            preview,
            [preview],
            user.email,
            selectedPlot,
          )

          let record = localRecord
          try {
            record = await saveScanRequest(localRecord, token)
            saveAnalysis(record)
          } catch {
            saveAnalysis(localRecord)
            failedHistorySaves += 1
          }
          savedRecords.push(record)
        }

        const firstRecord = savedRecords[0]
        setLatestRecord(firstRecord)
        setChatMessages([
          {
            role: 'assistant',
            content:
              'I saved each uploaded photo as its own scan. Open history to compare them, or ask about the scan shown here.',
          },
        ])
        setChatInput('')
        setChatError('')
        setScanNotice(
          `${savedRecords.length} separate scans saved from this batch. ${
            failedHistorySaves
              ? `${failedHistorySaves} server save failed and stayed cached on this browser.`
              : 'Open history to review every photo.'
          }`,
        )
        return
      }

      const response = await uploadLeafRequest(selectedFiles, token)
      const localRecord = buildAnalysisRecordFromResponse(
        response,
        fileName,
        imageDataUrl,
        imageDataUrls.length ? imageDataUrls : [imageDataUrl],
        user.email,
        selectedPlot,
      )
      let record = localRecord
      try {
        record = await saveScanRequest(localRecord, token)
        saveAnalysis(record)
      } catch {
        saveAnalysis(localRecord)
        setError(
          'The scan finished, but server history did not save. It is cached on this browser.',
        )
      }
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
      isLatestRecordOutOfScope ||
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
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <div className="crop-fade-up rounded-2xl border border-stroke bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-leaf-700">
              Leaf check
            </p>
            <HelpTip label="How scanning works">
              Uploading several files creates several saved scans. Camera angles are
              combined only when they are from the same plant.
            </HelpTip>
          </div>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
            Upload a leaf photo
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            For accurate analysis, ensure the leaf is well-lit and placed against a
            neutral background. Direct sunlight preferred.
          </p>

          <div className="mt-6 grid gap-2 rounded-md bg-surface-2 p-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setCaptureMode('upload')
                setCameraError('')
                stopCameraStream()
              }}
              className={`crop-touch inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition ${
                captureMode === 'upload'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-muted hover:text-forest-900'
              }`}
            >
              <Upload className="h-4.5 w-4.5" strokeWidth={2.2} />
              Upload image
            </button>
            <button
              type="button"
              onClick={() => {
                void handleStartCamera()
              }}
              disabled={!isCameraSupported || isStartingCamera || isAnalyzing}
              className={`crop-touch inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition ${
                captureMode === 'camera'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-muted hover:text-forest-900'
              } disabled:cursor-not-allowed disabled:text-outline`}
            >
              <Camera className="h-4.5 w-4.5" strokeWidth={2.2} />
              {isStartingCamera ? 'Opening camera...' : 'Use camera'}
            </button>
          </div>

          {captureMode === 'upload' ? (
            <label
              htmlFor="leaf-photo"
              className="group relative mt-6 flex min-h-[19rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stroke bg-canvas p-6 text-center transition hover:border-leaf-700 hover:bg-surface-2"
            >
              <span className="crop-viewfinder-bracket crop-viewfinder-bracket--tl" />
              <span className="crop-viewfinder-bracket crop-viewfinder-bracket--tr" />
              <span className="crop-viewfinder-bracket crop-viewfinder-bracket--bl" />
              <span className="crop-viewfinder-bracket crop-viewfinder-bracket--br" />
              {imageDataUrl ? (
                <div className="relative w-full">
                  <img
                    src={imageDataUrl}
                    alt="Selected leaf preview"
                    className="h-72 w-full rounded-md object-cover sm:h-80"
                  />
                  {isAnalyzing ? (
                    <div className="crop-scan-overlay flex items-end justify-center p-4">
                      <span className="rounded-full bg-forest-900/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-lime">
                        scanning image
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="crop-viewfinder-breath max-w-xs">
                  <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-lime text-forest-900">
                    <Upload className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  <span className="font-display block text-xl font-bold tracking-tight text-forest-900">
                    Tap to capture or drop file
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted">
                    Pick one photo, or up to three to check as separate scans.
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted ring-1 ring-stroke">
                    JPEG, PNG, HEIC up to 10 MB
                  </span>
                </span>
              )}
              <input
                id="leaf-photo"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={handleImageChange}
              />
            </label>
          ) : (
            <div className="mt-6 rounded-lg border border-stroke bg-leaf-300/20 p-4">
              <div className="mb-3 rounded-md bg-white px-3 py-2 text-sm font-bold text-forest-700 ring-1 ring-stroke">
                {selectedFiles.length === 0
                  ? 'Same plant, photo 1: close-up'
                  : selectedFiles.length === 1
                    ? 'Same plant, photo 2: leaf back'
                    : selectedFiles.length === 2
                      ? 'Same plant, photo 3: whole plant'
                      : 'Photo set ready'}
              </div>
              {imageDataUrl && !isCameraActive && !isStartingCamera ? (
                <div className="relative">
                  <img
                    src={imageDataUrl}
                    alt="Captured leaf preview"
                    className="h-72 w-full rounded-md object-cover sm:h-80"
                  />
                  {isAnalyzing ? (
                    <div className="crop-scan-overlay flex items-end justify-center p-4">
                      <span className="rounded-full bg-forest-700/90 px-3 py-1 text-xs font-black uppercase text-lime">
                        scanning image
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-md bg-surface-2">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-72 w-full object-cover sm:h-80"
                  />
                  {isStartingCamera ? (
                    <div className="absolute inset-0 grid place-items-center bg-forest-700/75 text-center text-white">
                      <div>
                        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        <p className="mt-3 text-sm font-black">Opening camera...</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                {isCameraActive ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="w-full cursor-pointer rounded-md bg-forest-700 px-4 py-3 text-sm font-black text-white transition hover:bg-forest-700 sm:w-auto"
                    >
                      {selectedFiles.length === 0
                        ? 'Snap close-up'
                        : selectedFiles.length === 1
                          ? 'Snap leaf back'
                          : 'Snap whole plant'}
                    </button>
                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="w-full cursor-pointer rounded-md bg-white px-4 py-3 text-sm font-black text-forest-700 ring-1 ring-stroke transition hover:bg-canvas sm:w-auto"
                    >
                      Close camera
                    </button>
                    {selectedFiles.length > 0 ? (
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="w-full cursor-pointer rounded-md bg-sun-orange px-4 py-3 text-sm font-black text-white transition hover:bg-orange-500 sm:w-auto"
                      >
                        Done
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void handleStartCamera()
                      }}
                      disabled={isStartingCamera || !isCameraSupported || isAnalyzing}
                      className="w-full cursor-pointer rounded-md bg-forest-700 px-4 py-3 text-sm font-black text-white transition hover:bg-forest-700 sm:w-auto disabled:cursor-not-allowed disabled:bg-outline"
                    >
                      {isStartingCamera ? 'Opening camera...' : 'Open camera'}
                    </button>
                    {imageDataUrl ? (
                      <button
                        type="button"
                        onClick={handleRetakeCameraPhoto}
                        className="w-full cursor-pointer rounded-md bg-white px-4 py-3 text-sm font-black text-forest-700 ring-1 ring-stroke transition hover:bg-canvas sm:w-auto"
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
            <p className="mt-3 truncate text-sm font-bold text-muted">
              Selected: {fileName}
            </p>
          )}

          {imageDataUrls.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imageDataUrls.map((dataUrl, index) => (
                <div
                  key={`${dataUrl.slice(0, 40)}-${index}`}
                  className="relative overflow-hidden rounded-md border border-stroke"
                >
                  <img
                    src={dataUrl}
                    alt={`Selected leaf angle ${index + 1}`}
                    className="h-20 w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-forest-700/90 px-2 py-0.5 text-[10px] font-black text-lime">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRemoveSelectedPhoto(index)
                    }}
                    className="absolute right-1 top-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded bg-white/95 text-danger shadow-sm transition hover:bg-red-50"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-sm leading-6 text-muted">
            Best results come from one leaf, bright lighting, and a simple background.
          </p>

          {plots.length > 0 ? (
            <div className="mt-4 rounded-lg bg-white p-3 ring-1 ring-stroke">
              <label
                htmlFor="scan-plot"
                className="text-sm font-black text-forest-700"
              >
                Save this scan to a growing spot
              </label>
              <select
                id="scan-plot"
                value={selectedPlotId}
                onChange={(event) => {
                  setSelectedPlotId(event.target.value)
                  setAutoPlotNotice('')
                }}
                className="mt-2 min-h-12 w-full cursor-pointer rounded-md border border-stroke bg-white px-3 py-2 text-sm font-bold text-forest-700 outline-none transition focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
              >
                <option value="">No spot selected</option>
                {plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name} - {plot.crop}
                  </option>
                ))}
              </select>
              {autoPlotNotice ? (
                <p className="mt-2 rounded-md bg-leaf-300/20 px-3 py-2 text-xs font-black uppercase text-leaf-700 ring-1 ring-leaf-300/40">
                  {autoPlotNotice}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-white p-3 text-sm leading-6 text-muted ring-1 ring-stroke">
              Want weather-aware history later?{' '}
              <Link
                to="/plots"
                className="cursor-pointer font-black text-leaf-500 hover:text-forest-700"
              >
                Add a growing spot
              </Link>
              .
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={selectedFiles.length === 0 || isReadingFile || isAnalyzing}
            className="crop-touch mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft hover:shadow-lg hover:shadow-[#bef264]/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none disabled:hover:translate-y-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                Analyzing leaf...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" strokeWidth={2.2} />
                {`Run both models${
                  selectedFiles.length > 1 ? ` on ${selectedFiles.length} photos` : ''
                }`}
              </>
            )}
          </button>

          {cameraError && (
            <p className="mt-4 rounded-md bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-200">
              {cameraError}
            </p>
          )}

          {scanNotice && (
            <p className="mt-4 rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
              {scanNotice}
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="crop-fade-up rounded-2xl bg-forest-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">
                {isAnalyzing && !latestRecord
                  ? 'While analyzing'
                  : 'Model comparison'}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Diagnosis result
              </h2>
            </div>
            <Link
              to="/dashboard"
              className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <History className="h-4.5 w-4.5" strokeWidth={2.2} />
              View history
            </Link>
          </div>

          {!latestRecord && isAnalyzing ? (
            <div className="mt-8 space-y-5">
              <div className="rounded-xl border border-white/15 bg-white/[0.06] p-6">
                <div className="flex items-center gap-3 text-sm font-bold tracking-tight text-white">
                  <Loader2
                    className="h-5 w-5 animate-spin text-lime"
                    strokeWidth={2.4}
                  />
                  Processing
                </div>
                <ul className="mt-5 space-y-3">
                  {ANALYZING_STEPS.map(({ label, icon: Icon }, index) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime/20 text-lime">
                        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                      </span>
                      <span className="text-sm font-bold tracking-tight text-white">
                        {label}
                      </span>
                      <span
                        className="ml-auto h-2 w-2 rounded-full bg-lime"
                        style={{
                          animationDelay: `${index * 200}ms`,
                          animation: 'crop-typing 1.4s ease-in-out infinite',
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-5 flex items-center gap-2 text-xs font-medium text-canvas/90">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Securely processing via CropScan AI Core
                </p>
              </div>
            </div>
          ) : !latestRecord ? (
            <div className="mt-8 rounded-xl border border-white/15 bg-white/[0.06] p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime/15 text-lime">
                <Sparkles className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="font-display mt-5 text-2xl font-bold tracking-tight text-white">
                No result yet
              </p>
              <p className="mt-2 text-sm leading-relaxed text-canvas/90">
                Upload a clear image and run both models. The completed analysis
                will appear here and will be saved automatically.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div
                className={`flex items-start gap-4 rounded-2xl p-5 ${
                  latestRecord.status === 'High confidence'
                    ? 'bg-lime text-forest-900'
                    : 'bg-orange-200 text-orange-900'
                }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    latestRecord.status === 'High confidence'
                      ? 'bg-forest-900/10 text-forest-900'
                      : 'bg-orange-100 text-orange-900'
                  }`}
                >
                  {latestRecord.status === 'High confidence' ? (
                    <CheckCircle2 className="h-6 w-6" strokeWidth={2.2} />
                  ) : (
                    <AlertTriangle className="h-6 w-6" strokeWidth={2.2} />
                  )}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em]">
                    {friendlyStatus(latestRecord)}
                  </p>
                  <p className="font-display mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                    {(latestRecord.cropType ||
                      latestRecord.predictions[0]?.crop ||
                      'Review needed') +
                      ' — ' +
                      (latestRecord.condition ||
                        latestRecord.predictions[0]?.disease ||
                        'Retake photo')}
                  </p>
                  {latestRecord.diagnosisReason && (
                    <p className="mt-2 text-sm font-medium opacity-90">
                      {friendlyReasonLabel(latestRecord)}:{' '}
                      {latestRecord.diagnosisReason}
                    </p>
                  )}
                </div>
              </div>

              {latestRecord.predictions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {latestRecord.predictions.map((prediction) => (
                    <div
                      key={prediction.modelName}
                      className="rounded-lg border border-white/15 bg-white p-5 text-forest-700"
                    >
                      <p className="text-sm font-black text-leaf-500">
                        {prediction.modelName}
                      </p>
                      <p className="mt-3 text-3xl font-black">
                        {prediction.confidence}%
                      </p>
                      <p className="mt-2 text-sm font-bold text-muted">
                        {prediction.crop} - {prediction.disease}
                      </p>
                      {(prediction.confidenceMargin !== undefined ||
                        prediction.entropy !== undefined) && (
                        <p className="mt-2 text-xs font-bold text-outline">
                          Margin:{' '}
                          {prediction.confidenceMargin !== undefined
                            ? Math.round(prediction.confidenceMargin * 100)
                            : 'n/a'}
                          % | Entropy:{' '}
                          {prediction.entropy !== undefined
                            ? prediction.entropy.toFixed(2)
                            : 'n/a'}
                        </p>
                      )}
                      {prediction.topK && (
                        <div className="mt-4 space-y-2 border-t border-stroke pt-3">
                          {prediction.topK.slice(0, 3).map((topPrediction) => (
                            <p
                              key={`${prediction.modelName}-${topPrediction.className}`}
                              className="flex justify-between gap-3 text-xs font-bold text-muted"
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
              ) : (
                <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                  <p className="text-sm font-black text-lime">
                    No model diagnosis was run
                  </p>
                  <p className="mt-2 text-sm leading-6 text-canvas">
                    CropScan stopped before diagnosis because the upload did not pass
                    the leaf-image gate. Retake the photo and keep one crop leaf centered.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-black text-lime">
                      {latestRecord.recommendationDetails?.headline || 'Recommendation'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-canvas">
                      {latestRecord.recommendationDetails?.overview ||
                        latestRecord.recommendation}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${
                      latestRecord.recommendationDetails?.urgency === 'high'
                        ? 'bg-red-200 text-red-900'
                        : latestRecord.recommendationDetails?.urgency === 'low'
                          ? 'bg-leaf-300/30 text-leaf-700'
                          : 'bg-orange-200 text-sun-orange'
                    }`}
                  >
                    {latestRecord.recommendationDetails?.urgency || 'medium'} urgency
                  </span>
                </div>

                {latestRecord.recommendationDetails?.immediateSteps?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-lime">
                      Immediate steps
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-canvas">
                      {latestRecord.recommendationDetails.immediateSteps.map((step) => (
                        <li key={step} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-lime" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestRecord.recommendationDetails?.productCategories?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-lime">
                      Product categories to consider
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latestRecord.recommendationDetails.productCategories.map(
                        (category) => (
                          <span
                            key={category}
                            className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-canvas ring-1 ring-white/10"
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
                    <h4 className="text-xs font-black uppercase tracking-wide text-lime">
                      Supply plan
                    </h4>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {latestRecord.recommendationDetails.productRecommendations.map(
                        (product) => (
                          <article
                            key={`${product.category}-${product.title}`}
                            className="rounded-lg border border-white/10 bg-white p-4 text-forest-700 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-black uppercase text-leaf-500">
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
                            <p className="mt-3 text-sm leading-6 text-muted">
                              {product.useCase}
                            </p>
                            <div className="mt-3 space-y-2 border-t border-stroke pt-3 text-xs font-bold text-muted">
                              <p>Timing: {product.timing}</p>
                              <p>Buyer's note: {product.buyerNote}</p>
                              <p className="text-sun-orange">{product.caution}</p>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase text-canvas/90">
                      Category-level suggestions only. Confirm labels before purchase
                      or application.
                    </p>
                  </div>
                ) : null}

                {latestRecord.recommendationDetails?.cautions?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-lime">
                      Cautions
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-canvas">
                      {latestRecord.recommendationDetails.cautions.map((caution) => (
                        <li key={caution} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-sun-orange" />
                          <span>{caution}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-5 text-sm font-bold text-canvas/90">
                  {latestRecord.recommendationDetails?.followUp ||
                    latestRecord.recommendation}
                </p>
              </div>

              <div className="crop-fade-up rounded-lg border border-white/15 bg-canvas p-4 text-forest-700 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 border-b border-stroke pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-forest-700">
                      CropScan chat
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Follow up on timing, spread risk, supplies, or next steps.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-muted ring-1 ring-stroke">
                      {usedQuestionCount}/{MAX_CHAT_QUESTIONS} used
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                        hasReachedChatLimit
                          ? 'bg-red-200 text-red-900'
                          : 'bg-leaf-300/30 text-leaf-700'
                      }`}
                    >
                      {hasReachedChatLimit
                        ? 'Limit reached'
                        : `${remainingQuestionCount} left`}
                    </span>
                  </div>
                </div>

                <div className="crop-chat-scroll mt-5 max-h-[520px] min-h-[320px] space-y-3 overflow-y-auto rounded-lg border border-stroke bg-white p-3 sm:p-4">
                  {chatMessages.length === 0 ? (
                    <div className="grid gap-2 pt-2 sm:grid-cols-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted sm:col-span-2">
                        Try asking
                      </p>
                      {QUICK_CHAT_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setChatInput(prompt)}
                          disabled={
                            !latestRecord ||
                            isLatestRecordOutOfScope ||
                            hasReachedChatLimit ||
                            isSendingChat
                          }
                          className="crop-bubble-in cursor-pointer rounded-lg bg-canvas px-3 py-3 text-left text-sm font-bold text-forest-700 ring-1 ring-stroke transition hover:bg-leaf-300/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    chatMessages.map((message, index) => {
                      const isAssistant = message.role === 'assistant'
                      const isFallback =
                        isAssistant &&
                        message.content.includes(
                          'live assistant is unavailable',
                        )
                      return (
                        <div
                          key={`${message.role}-${index}`}
                          className={`flex gap-2 ${
                            isAssistant ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          {isAssistant ? (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-forest-700 text-[11px] font-black text-lime">
                              CS
                            </div>
                          ) : null}
                          <div
                            className={`crop-bubble-in max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 sm:max-w-[72%] ${
                              isAssistant
                                ? 'rounded-tl-md border border-stroke bg-canvas text-forest-700'
                                : 'rounded-tr-md bg-forest-700 text-white'
                            }`}
                          >
                            {isFallback ? (
                              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-sun-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sun-orange">
                                <WifiOff className="h-3 w-3" strokeWidth={2.5} />
                                Local guidance
                              </span>
                            ) : null}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          {!isAssistant ? (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sun-orange text-[11px] font-black text-white">
                              You
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                  {isSendingChat ? (
                    <div className="flex gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-forest-700 text-[11px] font-black text-lime">
                        CS
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-stroke bg-canvas px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-leaf-500" />
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-leaf-500" />
                          <span className="crop-typing-dot h-2 w-2 rounded-full bg-leaf-500" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>

                {chatError ? (
                  <p className="mt-2 text-sm font-bold text-danger">{chatError}</p>
                ) : isLatestRecordOutOfScope ? (
                  <p className="mt-2 text-sm font-bold text-sun-orange">
                    Retake the image before using diagnosis chat.
                  </p>
                ) : hasReachedChatLimit ? (
                  <p className="mt-2 text-sm font-bold text-sun-orange">
                    You have reached the 10-question limit for this scan.
                  </p>
                ) : null}

                <div className="mt-3 flex items-end gap-2">
                  <div className="flex flex-1 items-end gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-stroke focus-within:ring-2 focus-within:ring-leaf-500">
                    <textarea
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={handleChatKeyDown}
                      rows={1}
                      maxLength={1500}
                      placeholder="Ask a follow-up…"
                      disabled={
                        !latestRecord ||
                        isLatestRecordOutOfScope ||
                        hasReachedChatLimit
                      }
                      className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent py-1 text-sm leading-6 text-forest-700 outline-none placeholder:text-outline disabled:cursor-not-allowed"
                    />
                    {chatInput.length > 1300 ? (
                      <span className="self-center text-[11px] font-bold text-outline">
                        {chatInput.length}/1500
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleSendChat}
                    disabled={
                      !latestRecord ||
                      isLatestRecordOutOfScope ||
                      !chatInput.trim() ||
                      isSendingChat ||
                      hasReachedChatLimit
                    }
                    aria-label="Send message"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline"
                  >
                    {isSendingChat ? (
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                    ) : (
                      <Send className="h-5 w-5" strokeWidth={2.2} />
                    )}
                  </button>
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
