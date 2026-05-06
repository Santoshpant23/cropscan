import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  History,
  Layers,
  ScanSearch,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  clearScansRequest,
  deleteScanRequest,
  getScansRequest,
  updateScanNotesRequest,
} from '../lib/api'
import {
  clearUserAnalyses,
  deleteAnalysis,
  getUserAnalyses,
  updateAnalysisNotes,
} from '../lib/storage'
import type { AnalysisRecord } from '../types'

function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function getRecordTitle(record: AnalysisRecord) {
  const firstPrediction = record.predictions[0]
  const crop = record.cropType || firstPrediction?.crop || 'Review needed'
  const condition = record.condition || firstPrediction?.disease || 'Retake photo'
  return `${crop} — ${condition}`
}

function getRecordImageAlt(record: AnalysisRecord) {
  const firstPrediction = record.predictions[0]
  return firstPrediction
    ? `${firstPrediction.crop} leaf`
    : 'Uploaded image needing review'
}

function friendlyStatus(record: AnalysisRecord) {
  if (record.diagnosisState === 'out_of_scope') return 'Needs a clearer photo'
  if (record.diagnosisState === 'uncertain_need_more_photos') return 'Try one more angle'
  if (record.status === 'High confidence') return 'Healthy reading'
  return 'Needs another look'
}

function statusToneClass(record: AnalysisRecord) {
  if (record.status === 'High confidence') {
    return 'bg-leaf-300/30 text-leaf-700 ring-leaf-300/40'
  }
  if (record.diagnosisState === 'out_of_scope') {
    return 'bg-red-50 text-danger ring-red-200'
  }
  return 'bg-sun-orange-soft text-sun-orange ring-orange-200'
}

function Dashboard() {
  const { token, user } = useAuth()
  const [records, setRecords] = useState<AnalysisRecord[]>(() =>
    user ? getUserAnalyses(user.email) : [],
  )
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(records.map((record) => [record.id, record.notes])),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!token || !user) return

    const activeToken = token
    const activeUser = user
    let isMounted = true
    async function loadScans() {
      setIsLoading(true)
      setLoadError('')
      try {
        const serverRecords = await getScansRequest(activeToken)
        if (!isMounted) return
        setRecords(serverRecords)
        setDraftNotes(
          Object.fromEntries(
            serverRecords.map((record) => [record.id, record.notes || '']),
          ),
        )
      } catch (caughtError) {
        if (!isMounted) return
        const localRecords = getUserAnalyses(activeUser.email)
        setRecords(localRecords)
        setDraftNotes(
          Object.fromEntries(
            localRecords.map((record) => [record.id, record.notes || '']),
          ),
        )
        setLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not load server scan history.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadScans()

    return () => {
      isMounted = false
    }
  }, [token, user])

  const stats = useMemo(() => {
    const total = records.length
    const high = records.filter((record) => record.status === 'High confidence').length
    const anomalies = total - high
    const healthyRate = total === 0 ? 0 : Math.round((high / total) * 100)
    return { total, anomalies, healthyRate }
  }, [records])

  async function handleDelete(id: string) {
    if (!token) return
    if (!window.confirm('Delete this saved scan?')) return

    const previousRecords = records
    setRecords((currentRecords) => currentRecords.filter((record) => record.id !== id))
    deleteAnalysis(id)
    try {
      await deleteScanRequest(id, token)
    } catch (caughtError) {
      setRecords(previousRecords)
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete this scan.',
      )
    }
  }

  async function handleClear() {
    if (!user || !token) return
    if (!window.confirm('Delete all saved scans for this account?')) return

    const previousRecords = records
    clearUserAnalyses(user.email)
    setRecords([])
    setDraftNotes({})
    try {
      await clearScansRequest(token)
    } catch (caughtError) {
      setRecords(previousRecords)
      setDraftNotes(
        Object.fromEntries(
          previousRecords.map((record) => [record.id, record.notes || '']),
        ),
      )
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not clear scan history.',
      )
    }
  }

  async function handleSaveNote(id: string) {
    if (!token) return
    const notes = draftNotes[id] ?? ''
    updateAnalysisNotes(id, notes)
    const previousRecords = records
    setRecords((currentRecords) =>
      currentRecords.map((record) => (record.id === id ? { ...record, notes } : record)),
    )
    try {
      const updatedRecord = await updateScanNotesRequest(id, notes, token)
      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === id ? updatedRecord : record,
        ),
      )
    } catch (caughtError) {
      setRecords(previousRecords)
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save this note.',
      )
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-leaf-700">
            Saved analyses
          </p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight text-forest-900 sm:text-5xl">
            Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Your recent scan history and field insights.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/plots"
            className="crop-touch inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-5 text-sm font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
          >
            <Layers className="h-4.5 w-4.5" strokeWidth={2.2} />
            Plots
          </Link>
          <Link
            to="/scan"
            className="crop-touch inline-flex items-center gap-2 rounded-md bg-lime px-5 text-sm font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft hover:-translate-y-0.5"
          >
            <Camera className="h-4.5 w-4.5" strokeWidth={2.2} />
            New scan
          </Link>
          <button
            type="button"
            onClick={handleClear}
            disabled={records.length === 0}
            className="crop-touch inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-5 text-sm font-bold text-muted transition hover:border-danger/40 hover:bg-red-50 hover:text-danger disabled:cursor-not-allowed disabled:text-outline disabled:hover:bg-white disabled:hover:text-outline"
          >
            <Trash2 className="h-4.5 w-4.5" strokeWidth={2.2} />
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total scans',
            value: stats.total,
            icon: History,
            tone: 'text-leaf-700 bg-leaf-300/30',
          },
          {
            label: 'Anomalies detected',
            value: stats.anomalies,
            icon: AlertTriangle,
            tone: 'text-sun-orange bg-sun-orange-soft',
          },
          {
            label: 'Healthy reading rate',
            value: `${stats.healthyRate}%`,
            icon: Sparkles,
            tone: 'text-leaf-700 bg-leaf-300/30',
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="crop-fade-up flex items-center gap-4 rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-md ${tone}`}
            >
              <Icon className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {label}
              </p>
              <p className="font-display mt-1 text-3xl font-bold tracking-tight text-forest-900">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-8 rounded-2xl border border-stroke bg-white p-6 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
          <div className="mt-4 h-24 w-full animate-pulse rounded bg-leaf-300/20" />
        </div>
      ) : null}

      {loadError ? (
        <p
          role="alert"
          className="mt-6 rounded-md bg-sun-orange-soft px-4 py-3 text-sm font-bold text-sun-orange ring-1 ring-orange-200"
        >
          {loadError}
        </p>
      ) : null}

      {!isLoading && records.length === 0 ? (
        <div className="mt-8 overflow-hidden rounded-2xl bg-forest-900 p-8 text-white shadow-sm sm:p-12">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime/15 text-lime">
              <ScanSearch className="h-7 w-7" strokeWidth={2} />
            </span>
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                No scans saved yet
              </h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-canvas/90">
                Run a scan to create the first saved history record for this account.
              </p>
            </div>
          </div>
          <Link
            to="/scan"
            className="crop-touch mt-6 inline-flex items-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft hover:-translate-y-0.5"
          >
            <Camera className="h-5 w-5" strokeWidth={2.2} />
            Start first scan
          </Link>
        </div>
      ) : records.length > 0 ? (
        <div className="mt-8 grid gap-5">
          {records.map((record) => (
            <article
              key={record.id}
              className="crop-fade-up grid gap-5 rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:grid-cols-[240px_1fr]"
            >
              <img
                src={record.imageDataUrl}
                alt={getRecordImageAlt(record)}
                loading="lazy"
                decoding="async"
                className="h-56 w-full rounded-xl object-cover lg:h-full"
              />

              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
                      {record.plotName ? (
                        <>
                          <Layers className="h-3.5 w-3.5" strokeWidth={2.4} />
                          {record.plotName}
                        </>
                      ) : (
                        <>
                          <ScanSearch className="h-3.5 w-3.5" strokeWidth={2.4} />
                          Single scan
                        </>
                      )}
                    </p>
                    <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-forest-900 sm:text-3xl">
                      {getRecordTitle(record)}
                    </h2>
                    <p className="mt-2 text-sm font-medium text-muted">
                      Scanned {formatTimeAgo(record.createdAt)} · {record.fileName}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 ${statusToneClass(
                      record,
                    )}`}
                  >
                    {record.status === 'High confidence' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
                    )}
                    {friendlyStatus(record)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {record.predictions.length > 0 ? (
                    record.predictions.map((prediction) => (
                      <div
                        key={prediction.modelName}
                        className="rounded-xl bg-canvas p-4 ring-1 ring-stroke"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">
                          {prediction.modelName}
                        </p>
                        <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-forest-900">
                          {prediction.confidence}%
                        </p>
                        <p className="mt-1 text-xs font-medium text-muted">
                          {prediction.crop} · {prediction.disease}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-sun-orange-soft p-4 ring-1 ring-orange-200 sm:col-span-2">
                      <p className="text-sm font-bold text-sun-orange">
                        No model prediction
                      </p>
                      <p className="mt-2 text-sm leading-6 text-orange-900">
                        This upload was saved as a retake-needed record because it
                        did not pass the leaf-image check.
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-5 text-sm leading-6 text-muted">
                  {record.recommendation}
                </p>

                {record.recommendationDetails?.productRecommendations?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.recommendationDetails.productRecommendations
                      .slice(0, 3)
                      .map((product) => (
                        <span
                          key={`${record.id}-${product.title}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-leaf-300/20 px-3 py-1.5 text-xs font-bold text-leaf-700 ring-1 ring-leaf-300/40"
                        >
                          {product.category}: {product.title}
                        </span>
                      ))}
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl bg-canvas p-4 ring-1 ring-stroke">
                  <label
                    htmlFor={`notes-${record.id}`}
                    className="block text-xs font-bold uppercase tracking-wide text-leaf-700"
                  >
                    Field note
                  </label>
                  <textarea
                    id={`notes-${record.id}`}
                    value={draftNotes[record.id] ?? ''}
                    onChange={(event) =>
                      setDraftNotes((currentNotes) => ({
                        ...currentNotes,
                        [record.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2 w-full resize-none rounded-md border border-stroke bg-white px-3 py-2 text-sm text-forest-900 outline-none transition focus:border-leaf-700 focus:ring-4 focus:ring-leaf-300/40"
                    placeholder="Add field conditions, treatment decision, or follow-up date"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveNote(record.id)
                    }}
                    className="crop-touch inline-flex items-center gap-2 rounded-md bg-forest-700 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-forest-900"
                  >
                    Save note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(record.id)
                    }}
                    className="crop-touch inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-5 text-sm font-bold text-danger transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default Dashboard
