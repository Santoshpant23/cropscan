import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Footprints,
  Leaf,
  Loader2,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Square,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  walkAnalyzeRequest,
  walkSummaryRequest,
  walkWarmupRequest,
} from '../lib/api'
import type {
  WalkAnalyzeResponse,
  WalkFrameInput,
  WalkFrameResult,
  WalkSummaryWindow,
} from '../types'

const WALK_HANDOFF_KEY = 'cropscan_walk_handoff'

function vibrateIfAvailable(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  const vibrate = navigator.vibrate?.bind(navigator)
  if (vibrate) vibrate(pattern)
}

type Phase =
  | 'idle'
  | 'requesting_camera'
  | 'preview'
  | 'calibrating'
  | 'walking'
  | 'analyzing'
  | 'summarizing'
  | 'done'
  | 'error'

const CALIBRATION_SECONDS = 3
const WALK_SECONDS = 12
const FRAME_INTERVAL_MS = 333 // ~3 FPS
const FRAME_WIDTH = 320
const FRAME_HEIGHT = 240
const FRAME_QUALITY = 0.72

const TOTAL_SECONDS = CALIBRATION_SECONDS + WALK_SECONDS

const LEVEL_COLOR: Record<string, string> = {
  calibration: '#10b981',
  low: '#bbf7d0',
  medium: '#fcd34d',
  high: '#f87171',
  low_plant_signal: '#cbd5e1',
  too_blurry: '#cbd5e1',
  decode_failed: '#cbd5e1',
  no_leaf_detected: '#cbd5e1',
  analysis_failed: '#cbd5e1',
  empty: '#e5e7eb',
}

const LEVEL_LABEL: Record<string, string> = {
  calibration: 'Healthy baseline',
  low: 'Looks like baseline',
  medium: 'A bit different',
  high: 'Stands out — check this',
  low_plant_signal: 'Skipped: not enough plant in frame',
  too_blurry: 'Skipped: too blurry',
  decode_failed: 'Skipped: could not read frame',
  no_leaf_detected: 'Skipped: no leaf detected',
  analysis_failed: 'Skipped: frame analysis failed',
}

function colorForFrame(frame: WalkFrameResult): string {
  if (frame.status === 'ok' && frame.level) return LEVEL_COLOR[frame.level]
  return LEVEL_COLOR[frame.status] || LEVEL_COLOR.empty
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDetectedTime(frame: WalkFrameResult): string {
  if (!frame.capturedAt) return formatSeconds(frame.timestampMs)
  const date = new Date(frame.capturedAt)
  if (Number.isNaN(date.getTime())) return formatSeconds(frame.timestampMs)
  return `${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })} (${formatSeconds(frame.timestampMs)})`
}

function buildSuspiciousWindows(frames: WalkFrameResult[]): WalkSummaryWindow[] {
  const windows: WalkSummaryWindow[] = []
  let openWindow: WalkSummaryWindow | null = null

  for (const frame of frames) {
    if (frame.status !== 'ok' || !frame.level || frame.level === 'low') {
      if (openWindow) {
        windows.push(openWindow)
        openWindow = null
      }
      continue
    }
    const incomingLevel = frame.level
    if (
      openWindow &&
      (incomingLevel === openWindow.level || frame.timestampMs - openWindow.endMs <= 1500)
    ) {
      openWindow.endMs = frame.timestampMs
      // Promote window severity if needed.
      if (openWindow.level === 'medium' && incomingLevel === 'high') {
        openWindow.level = 'high'
      }
    } else {
      if (openWindow) windows.push(openWindow)
      openWindow = {
        startMs: frame.timestampMs,
        endMs: frame.timestampMs,
        level: incomingLevel,
      }
    }
  }
  if (openWindow) windows.push(openWindow)
  return windows
}

function rankSuspiciousFrames(frames: WalkFrameResult[]): WalkFrameResult[] {
  return [...frames]
    .filter(
      (frame) =>
        frame.status === 'ok' &&
        (frame.level === 'medium' || frame.level === 'high'),
    )
    .sort((first, second) => (second.anomalyScore || 0) - (first.anomalyScore || 0))
}

function WalkScanPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureIntervalRef = useRef<number | null>(null)
  const phaseTimeoutRef = useRef<number | null>(null)
  const frameStorageRef = useRef<Map<number, { dataUrl: string; capturedAt: string }>>(
    new Map(),
  )
  const frameCounterRef = useRef<number>(0)
  const phaseRef = useRef<Phase>('idle')

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [frameCount, setFrameCount] = useState(0)
  const [analysis, setAnalysis] = useState<WalkAnalyzeResponse | null>(null)
  const [summary, setSummary] = useState('')
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const [warmupState, setWarmupState] = useState<
    'warming' | 'ready' | 'failed'
  >('warming')

  const cleanupAll = useCallback(() => {
    if (captureIntervalRef.current) {
      window.clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    if (phaseTimeoutRef.current) {
      window.clearTimeout(phaseTimeoutRef.current)
      phaseTimeoutRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => cleanupAll, [cleanupAll])

  useEffect(() => {
    if (!token) return
    let isMounted = true
    walkWarmupRequest(token)
      .then(() => {
        if (isMounted) setWarmupState('ready')
      })
      .catch(() => {
        if (isMounted) setWarmupState('failed')
      })
    return () => {
      isMounted = false
    }
  }, [token])

  async function handleStart() {
    if (phase !== 'idle' && phase !== 'done' && phase !== 'error') return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera. Try a recent mobile browser.')
      setPhase('error')
      return
    }

    setError('')
    setAnalysis(null)
    setSummary('')
    frameStorageRef.current = new Map()
    frameCounterRef.current = 0
    setFrameCount(0)
    setPhase('requesting_camera')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setPhase('preview')
    } catch {
      setError(
        'Could not open the camera. Check that you allowed camera access in this browser.',
      )
      setPhase('error')
    }
  }

  function handleBeginRecording() {
    if (phase !== 'preview') return

    setPhase('calibrating')
    vibrateIfAvailable(120)

    captureIntervalRef.current = window.setInterval(() => {
      captureFrame()
    }, FRAME_INTERVAL_MS)

    // Capture an initial frame immediately so calibration starts at t=0.
    captureFrame()

    phaseTimeoutRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'calibrating') {
        setPhase('walking')
        vibrateIfAvailable([60, 60, 60])
        phaseTimeoutRef.current = window.setTimeout(() => {
          if (phaseRef.current === 'walking') {
            void handleStop()
          }
        }, WALK_SECONDS * 1000)
      }
    }, CALIBRATION_SECONDS * 1000)
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = FRAME_WIDTH
    canvas.height = FRAME_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    const targetRatio = FRAME_WIDTH / FRAME_HEIGHT
    const sourceRatio = sourceWidth / sourceHeight
    let drawWidth = sourceWidth
    let drawHeight = sourceHeight
    let sx = 0
    let sy = 0
    if (sourceRatio > targetRatio) {
      drawWidth = sourceHeight * targetRatio
      sx = (sourceWidth - drawWidth) / 2
    } else if (sourceRatio < targetRatio) {
      drawHeight = sourceWidth / targetRatio
      sy = (sourceHeight - drawHeight) / 2
    }
    ctx.drawImage(
      video,
      sx,
      sy,
      drawWidth,
      drawHeight,
      0,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
    )

    const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY)
    const index = frameCounterRef.current
    frameCounterRef.current = index + 1
    frameStorageRef.current.set(index, {
      dataUrl,
      capturedAt: new Date().toISOString(),
    })
    setFrameCount(frameCounterRef.current)
  }

  async function handleStop() {
    if (captureIntervalRef.current) {
      window.clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    if (phaseTimeoutRef.current) {
      window.clearTimeout(phaseTimeoutRef.current)
      phaseTimeoutRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setPhase('analyzing')
    if (!token) {
      setError('You need to be logged in to run a Walk Scan.')
      setPhase('error')
      return
    }

    const frames: WalkFrameInput[] = []
    const calibrationCutoffMs = CALIBRATION_SECONDS * 1000
    const calibrationIndexes: number[] = []
    for (const [index, frame] of frameStorageRef.current.entries()) {
      const timestampMs = Math.round(index * FRAME_INTERVAL_MS)
      frames.push({
        index,
        timestampMs,
        capturedAt: frame.capturedAt,
        dataUrl: frame.dataUrl,
      })
      if (timestampMs < calibrationCutoffMs) {
        calibrationIndexes.push(index)
      }
    }

    if (frames.length < 4) {
      setError(
        'Not enough frames captured. Hold the camera up to a healthy section, then walk a few steps before stopping.',
      )
      setPhase('error')
      return
    }
    if (calibrationIndexes.length === 0) {
      setError('Calibration frames missing. Please try again.')
      setPhase('error')
      return
    }

    try {
      const response = await walkAnalyzeRequest(
        { frames, calibrationIndexes },
        token,
      )
      setAnalysis(response)
      setThumbnails(
        Object.fromEntries(
          [...frameStorageRef.current.entries()].map(([index, frame]) => [
            index,
            frame.dataUrl,
          ]),
        ),
      )
      setPhase('summarizing')

      const suspiciousWindows = buildSuspiciousWindows(response.frames)
      try {
        const summaryResponse = await walkSummaryRequest(
          {
            framesAnalyzed: response.framesAnalyzed,
            validFrameCount: response.validFrameCount,
            skippedFrameCount: response.skippedFrameCount,
            calibrationFrameCount: response.calibrationFrameCount,
            anomalyMean: response.anomalyMean,
            anomalyStdev: response.anomalyStdev,
            suspiciousWindows,
          },
          token,
        )
        setSummary(summaryResponse.summary)
      } catch {
        setSummary('')
      }
      setPhase('done')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Walk Scan analysis failed. Please try again.',
      )
      setPhase('error')
    }
  }

  function handleReset() {
    cleanupAll()
    frameStorageRef.current = new Map()
    frameCounterRef.current = 0
    setFrameCount(0)
    setAnalysis(null)
    setSummary('')
    setThumbnails({})
    setError('')
    setPhase('idle')
  }

  function handleScanFrame(frame: WalkFrameResult) {
    const dataUrl = thumbnails[frame.index]
    if (!dataUrl) return
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        WALK_HANDOFF_KEY,
        JSON.stringify({
          dataUrl,
          sourceTimestampMs: frame.timestampMs,
          sourceCapturedAt: frame.capturedAt,
        }),
      )
    }
    navigate('/scan')
  }

  const totalElapsedMs = Math.max(0, frameCount - 1) * FRAME_INTERVAL_MS
  const totalProgress = Math.min(1, totalElapsedMs / (TOTAL_SECONDS * 1000))
  const phaseLabel = (() => {
    if (phase === 'calibrating') {
      const remaining = Math.max(
        0,
        Math.ceil(CALIBRATION_SECONDS - totalElapsedMs / 1000),
      )
      return `Hold still on a healthy section. ${remaining}s`
    }
    if (phase === 'walking') {
      const walkedSeconds = totalElapsedMs / 1000 - CALIBRATION_SECONDS
      const remaining = Math.max(0, Math.ceil(WALK_SECONDS - walkedSeconds))
      return `Walk slowly along the row. ${remaining}s left`
    }
    return ''
  })()

  const suspiciousFrames = useMemo(
    () => (analysis ? rankSuspiciousFrames(analysis.frames).slice(0, 6) : []),
    [analysis],
  )

  const frameThumbnails = thumbnails

  const isRecording = phase === 'calibrating' || phase === 'walking'

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <div className="crop-fade-up rounded-2xl border border-stroke bg-white p-6 shadow-sm sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-orange-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-sun-orange">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            Beta
          </span>
          <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
            Walk Scan
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Walk slowly along a row while CropScan watches the live camera. We
            compare each second of the walk against the start of your video and
            flag the part of the row that stands out, so you know where to take a
            close-up scan.
          </p>

          <div className="mt-5 rounded-xl bg-canvas p-5 text-sm leading-6 text-forest-700 ring-1 ring-stroke">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
              <Footprints className="h-3.5 w-3.5" strokeWidth={2.4} />
              How it works
            </p>
            <ol className="mt-3 space-y-2.5 text-muted">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-300/30 text-xs font-bold text-leaf-700">
                  1
                </span>
                <span>
                  Aim the camera at a healthy-looking section for{' '}
                  {CALIBRATION_SECONDS} seconds. If the whole row looks bad, point
                  at your cleanest leaf — even one is enough.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-300/30 text-xs font-bold text-leaf-700">
                  2
                </span>
                <span>
                  Then walk slowly along the row for {WALK_SECONDS} seconds, keeping
                  leaves filling the frame.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-300/30 text-xs font-bold text-leaf-700">
                  3
                </span>
                <span>We mark the parts of the walk that look different from the start.</span>
              </li>
            </ol>
          </div>

          {warmupState === 'warming' || warmupState === 'failed' ? (
            <p
              className={`mt-3 rounded-md px-3 py-2 text-xs font-bold ring-1 ${
                warmupState === 'failed'
                  ? 'bg-red-50 text-danger ring-red-200'
                  : 'bg-sun-orange-soft text-sun-orange ring-orange-200'
              }`}
            >
              {warmupState === 'failed'
                ? 'Could not pre-load the Walk Scan model. The first scan will work but may take ~20 seconds extra while it downloads.'
                : 'Warming up the Walk Scan model in the background...'}
            </p>
          ) : null}

          {phase === 'idle' || phase === 'error' || phase === 'done' ? (
            <button
              type="button"
              onClick={() => void handleStart()}
              className="crop-touch mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft"
            >
              {phase === 'done' ? (
                <>
                  <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
                  Walk again
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" strokeWidth={2.2} />
                  Open camera
                </>
              )}
            </button>
          ) : null}

          {phase === 'preview' ? (
            <button
              type="button"
              onClick={handleBeginRecording}
              className="crop-touch mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft"
            >
              <Footprints className="h-5 w-5" strokeWidth={2.2} />
              Begin walk
            </button>
          ) : null}

          {isRecording ? (
            <button
              type="button"
              onClick={() => void handleStop()}
              className="crop-touch mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-forest-700 px-6 text-base font-bold text-white transition hover:bg-forest-900"
            >
              <Square className="h-4 w-4 fill-current" strokeWidth={2.2} />
              Stop early
            </button>
          ) : null}

          {phase === 'analyzing' || phase === 'summarizing' ? (
            <p className="mt-5 inline-flex w-full items-center gap-2 rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              {phase === 'analyzing'
                ? 'Scoring frames against your healthy baseline...'
                : 'Writing the scouting summary...'}
            </p>
          ) : null}

          {phase === 'done' ? (
            <button
              type="button"
              onClick={handleReset}
              className="crop-touch mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke bg-white px-5 text-sm font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
              Reset
            </button>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200">
              {error}
            </p>
          ) : null}

          <div className="mt-6 rounded-xl bg-surface-2 p-4 text-xs leading-5 text-muted ring-1 ring-stroke">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-forest-900">
              <Leaf className="h-3.5 w-3.5" strokeWidth={2.4} />
              What this is not
            </p>
            <p className="mt-2">
              Walk Scan does not name diseases. It tells you where on the row looks
              different so you can come back and scan the worst leaf with the
              regular leaf scanner.
            </p>
          </div>
        </div>

        <div className="crop-fade-up rounded-2xl bg-forest-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">
                {phase === 'done' ? 'Walk summary' : 'Live walk'}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {phase === 'done'
                  ? 'Walk complete'
                  : isRecording
                    ? phaseLabel
                    : 'Camera preview'}
              </h2>
            </div>
            {analysis ? (
              <Link
                to="/scan"
                className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                <ScanSearch className="h-4.5 w-4.5" strokeWidth={2.2} />
                Scan a single leaf
              </Link>
            ) : null}
          </div>

          <div className="relative mt-6 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
            <span className="crop-viewfinder-bracket crop-viewfinder-bracket--tl" />
            <span className="crop-viewfinder-bracket crop-viewfinder-bracket--tr" />
            <span className="crop-viewfinder-bracket crop-viewfinder-bracket--bl" />
            <span className="crop-viewfinder-bracket crop-viewfinder-bracket--br" />
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover transition-opacity ${
                  phase === 'idle' || phase === 'done' || phase === 'error'
                    ? 'opacity-30'
                    : ''
                }`}
              />
              {isRecording ? (
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  {phase === 'calibrating' ? 'Calibrating' : 'Walking'} ·{' '}
                  {frameCount} frames
                </div>
              ) : null}
              {phase === 'idle' || phase === 'error' ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-white/70">
                  Tap "Open camera" to begin.
                </div>
              ) : null}
            </div>
          </div>

          {isRecording ? (
            <div className="mt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="crop-walk-pulse h-full rounded-full bg-lime transition-all"
                  style={{ width: `${Math.round(totalProgress * 100)}%` }}
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-lime">
                <Footprints className="h-3.5 w-3.5" strokeWidth={2.4} />
                {phase === 'calibrating'
                  ? 'Calibrating: keep camera on a healthy section'
                  : 'Walking: move steady, leaves filling the frame'}
              </p>
            </div>
          ) : null}

          {analysis ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white p-6 text-forest-900 shadow-sm sm:p-7">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
                Walk summary
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted">
                {summary ||
                  'Walk Scan finished. The timeline below shows where the row looked different from your healthy baseline.'}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-canvas p-4 ring-1 ring-stroke">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Frames analyzed
                  </p>
                  <p className="font-display mt-1 text-2xl font-bold tracking-tight text-forest-900">
                    {analysis.framesAnalyzed}
                  </p>
                </div>
                <div className="rounded-xl bg-canvas p-4 ring-1 ring-stroke">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Suspicious moments
                  </p>
                  <p className="font-display mt-1 text-2xl font-bold tracking-tight text-forest-900">
                    {suspiciousFrames.length}
                  </p>
                </div>
                <div className="rounded-xl bg-canvas p-4 ring-1 ring-stroke">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Skipped frames
                  </p>
                  <p className="font-display mt-1 text-2xl font-bold tracking-tight text-forest-900">
                    {analysis.skippedFrameCount}
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
                  Timeline
                </p>
                <div className="mt-3 flex h-7 w-full overflow-hidden rounded-md ring-1 ring-stroke">
                  {analysis.frames.map((frame) => (
                    <div
                      key={frame.index}
                      className="h-full flex-1"
                      style={{ backgroundColor: colorForFrame(frame) }}
                      title={`${formatDetectedTime(frame)} - ${
                        LEVEL_LABEL[
                          frame.status === 'ok' && frame.level
                            ? frame.level
                            : frame.status
                        ] || frame.status
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted">
                  <LegendDot color={LEVEL_COLOR.calibration} label="Healthy baseline" />
                  <LegendDot color={LEVEL_COLOR.low} label="Same as baseline" />
                  <LegendDot color={LEVEL_COLOR.medium} label="A bit different" />
                  <LegendDot color={LEVEL_COLOR.high} label="Stands out" />
                  <LegendDot color={LEVEL_COLOR.too_blurry} label="Skipped" />
                </div>
              </div>

              {suspiciousFrames.length > 0 ? (
                <div className="mt-7">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Most suspicious moments
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {suspiciousFrames.map((frame) => (
                      <article
                        key={frame.index}
                        className="overflow-hidden rounded-xl border border-stroke bg-canvas shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="relative">
                          {frameThumbnails[frame.index] ? (
                            <img
                              src={frameThumbnails[frame.index]}
                              alt={`Frame at ${formatDetectedTime(frame)}`}
                              className="aspect-video w-full object-cover"
                            />
                          ) : (
                            <div className="aspect-video w-full bg-surface-2" />
                          )}
                          <span
                            className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              frame.level === 'high'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-sun-orange-soft text-sun-orange'
                            }`}
                          >
                            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
                            {frame.level}
                          </span>
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted">
                            Detected at {formatDetectedTime(frame)}
                          </p>
                          <p className="font-display mt-1 text-lg font-bold tracking-tight text-forest-900">
                            Anomaly {((frame.anomalyScore || 0) * 100).toFixed(1)}
                          </p>
                          {frame.diseaseName ? (
                            <p className="mt-2 text-sm font-bold leading-5 text-forest-700">
                              {frame.diseaseName}
                              {frame.diseaseConfidencePercent != null
                                ? ` (${frame.diseaseConfidencePercent.toFixed(1)}%)`
                                : ''}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleScanFrame(frame)}
                            className="crop-touch mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-forest-700 px-4 text-sm font-bold text-white transition hover:bg-forest-900"
                          >
                            <ScanSearch className="h-4 w-4" strokeWidth={2.2} />
                            Open in Scanner
                            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-7 flex items-start gap-3 rounded-xl bg-leaf-300/20 p-5 ring-1 ring-leaf-300/40">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-300/30 text-leaf-700">
                    <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <p className="text-sm font-medium leading-6 text-leaf-700">
                    No section of the row stood out clearly from the healthy
                    baseline. Walk again in a few days, or scan any leaf you are
                    worried about with the single-leaf scanner.
                  </p>
                </div>
              )}

              <p className="mt-6 text-xs leading-5 text-outline">
                Healthy baseline frames: {analysis.calibrationFrameCount} ·{' '}
                Mean anomaly: {(analysis.anomalyMean * 100).toFixed(1)} ·{' '}
                Stdev: {(analysis.anomalyStdev * 100).toFixed(1)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  )
}

export default WalkScanPage
