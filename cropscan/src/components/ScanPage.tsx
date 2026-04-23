import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [chatMessages, setChatMessages] = useState<DiagnosisChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [chatError, setChatError] = useState('')
  const [error, setError] = useState('')

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingFile(true)
    setLatestRecord(null)
    setError('')
    setChatMessages([])
    setChatInput('')
    setChatError('')
    setSelectedFile(file)
    setFileName(file.name)
    setImageDataUrl(await fileToDataUrl(file))
    setIsReadingFile(false)
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
            'I have the diagnosis context for this scan. Ask about treatment timing, spread risk, or useful product categories.',
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
    if (!message || !latestRecord || !token || isSendingChat) {
      return
    }

    const userMessage: DiagnosisChatMessage = { role: 'user', content: message }
    const messageHistory = [...chatMessages, userMessage]
    setChatMessages(messageHistory)
    setChatInput('')
    setChatError('')
    setIsSendingChat(true)

    try {
      const response = await diagnosisChatRequest(
        buildChatRequest(latestRecord, messageHistory, message),
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
            disabled={!imageDataUrl || isReadingFile || isAnalyzing}
            className="mt-5 w-full cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#a8b3aa]"
          >
            {isAnalyzing ? 'Analyzing leaf...' : 'Run both models'}
          </button>

          {error && (
            <p className="mt-4 rounded-md bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#be123c] ring-1 ring-[#fecdd3]">
              {error}
            </p>
          )}
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

              <div className="rounded-lg border border-white/15 bg-white/8 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-black text-[#bef264]">Ask CropScan</h3>
                    <p className="mt-2 text-sm leading-6 text-[#d1fae5]">
                      Follow up on treatment, product categories, spread risk, or next
                      steps for this diagnosis.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {chatMessages.length ? (
                    chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`rounded-lg px-4 py-3 text-sm leading-6 ${
                          message.role === 'assistant'
                            ? 'bg-white text-[#16351f]'
                            : 'bg-[#14532d] text-white'
                        }`}
                      >
                        <p className="mb-1 text-xs font-black uppercase tracking-wide text-[#15803d]">
                          {message.role === 'assistant' ? 'CropScan AI' : 'You'}
                        </p>
                        <p>{message.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#d1fae5]">
                      Run a scan first, then ask follow-up questions here.
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    rows={3}
                    placeholder="Ask about treatment timing, likely spread, or useful product categories."
                    className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-sm text-[#16351f] outline-none ring-0 placeholder:text-[#6b7a6e] focus:border-[#bef264]"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {chatError ? (
                      <p className="text-sm font-bold text-[#fecdd3]">{chatError}</p>
                    ) : (
                      <p className="text-xs font-bold uppercase tracking-wide text-[#d1fae5]">
                        Stateless diagnosis chat tied to this latest scan
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={!latestRecord || !chatInput.trim() || isSendingChat}
                      className="w-full cursor-pointer rounded-md bg-[#bef264] px-4 py-3 text-sm font-black text-[#16351f] transition hover:bg-[#a3e635] sm:w-auto disabled:cursor-not-allowed disabled:bg-[#b2c0b6]"
                    >
                      {isSendingChat ? 'Sending...' : 'Send question'}
                    </button>
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
