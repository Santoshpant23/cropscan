import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { deleteScanRequest, getScansRequest } from '../lib/api'
import { getDiseaseDisplay } from '../lib/diseaseInfo'
import type { AnalysisRecord } from '../types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function Dashboard() {
  const { token } = useAuth()
  const [records, setRecords] = useState<AnalysisRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError('')

    getScansRequest(token)
      .then((scans) => {
        if (isMounted) setRecords(scans)
      })
      .catch((caughtError) => {
        if (!isMounted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not load scan history.',
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const stats = useMemo(() => {
    const confidenceValues = records.flatMap((record) =>
      record.predictions.map((prediction) => prediction.confidence),
    )
    const averageConfidence =
      confidenceValues.length === 0
        ? 0
        : Math.round(
            confidenceValues.reduce((total, value) => total + value, 0) /
              confidenceValues.length,
          )

    return {
      total: records.length,
      highConfidence: records.filter((record) => record.status === 'High confidence')
        .length,
      averageConfidence,
    }
  }, [records])

  async function handleDelete(id: string) {
    if (!token) return
    try {
      await deleteScanRequest(id, token)
      setRecords((currentRecords) => currentRecords.filter((record) => record.id !== id))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete scan.')
    }
  }

  async function handleClear() {
    if (!token) return
    try {
      await Promise.all(records.map((record) => deleteScanRequest(record.id, token)))
      setRecords([])
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not clear scans.')
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#15803d]">Saved analyses</p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5d50]">
            Review past scans, compare model confidence, and remove records as the
            field history grows.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/scan"
            className="rounded-md bg-[#f97316] px-4 py-2 text-sm font-black text-white transition hover:bg-[#ea580c]"
          >
            New scan
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleClear()
            }}
            disabled={records.length === 0 || isLoading}
            className="cursor-pointer rounded-md border border-[#14532d]/15 bg-white px-4 py-2 text-sm font-bold text-[#16351f] transition hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:text-[#a8b3aa]"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Total scans', stats.total],
          ['High confidence', stats.highConfidence],
          ['Avg confidence', `${stats.averageConfidence}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#14532d]/10">
            <p className="text-sm font-bold text-[#4b5d50]">{label}</p>
            <p className="mt-2 text-3xl font-black text-[#16351f]">{value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-5 text-sm font-bold text-[#be123c]">
          {error}
        </div>
      ) : isLoading ? (
        <div className="mt-6 rounded-lg border border-[#14532d]/10 bg-white p-8 text-[#16351f] shadow-sm">
          <p className="text-2xl font-black">Loading scan history...</p>
          <p className="mt-2 text-sm leading-6 text-[#4b5d50]">
            Fetching saved scans for this account.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="mt-6 rounded-lg border border-[#14532d]/10 bg-[#16351f] p-8 text-white">
          <p className="text-2xl font-black">No scans saved yet</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#d1fae5]">
            Run a scan to create the first saved history record for this account.
          </p>
          <Link
            to="/scan"
            className="mt-5 inline-flex rounded-md bg-[#bef264] px-5 py-3 text-sm font-black text-[#16351f] transition hover:bg-[#d9f99d]"
          >
            Start first scan
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {records.map((record) => {
            const primaryPrediction = record.predictions[0]
            const diseaseInfo = getDiseaseDisplay({
              className: primaryPrediction?.className,
              rawDiseaseLabel:
                record.rawDiseaseLabel || primaryPrediction?.rawDiseaseLabel,
              disease: record.condition || primaryPrediction?.disease,
              diseaseFriendlyName:
                record.diseaseFriendlyName || primaryPrediction?.diseaseFriendlyName,
              diseaseExplanation:
                record.diseaseExplanation || primaryPrediction?.diseaseExplanation,
            })
            return (
            <article
              key={record.id}
              className="grid gap-5 rounded-lg border border-[#14532d]/10 bg-white p-4 shadow-sm lg:grid-cols-[220px_1fr]"
            >
              <div className="flex h-56 w-full items-center justify-center rounded-md bg-[#f0fdf4] p-4 text-center ring-1 ring-[#bbf7d0] lg:h-full">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#15803d]">
                    Uploaded image
                  </p>
                  <p className="mt-2 break-words text-sm font-bold text-[#16351f]">
                    {record.fileName}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#4b5d50]">
                      {formatDate(record.createdAt)} - {record.fileName}
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-[#16351f]">
                      {primaryPrediction?.crop || record.cropType || 'Review needed'} -{' '}
                      {diseaseInfo.friendlyName}
                    </h2>
                    {diseaseInfo.rawLabel ? (
                      <p className="mt-1 text-xs font-bold text-[#6b7a6f]">
                        Scientific label: {diseaseInfo.rawLabel}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-bold leading-6 text-[#4b5d50]">
                      What this means: {diseaseInfo.explanation}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md px-3 py-1 text-xs font-black ${
                      record.status === 'High confidence'
                        ? 'bg-[#bef264] text-[#16351f]'
                        : 'bg-[#fed7aa] text-[#7c2d12]'
                    }`}
                  >
                    {record.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {record.predictions.map((prediction) => (
                    <div
                      key={prediction.modelName}
                      className="rounded-lg bg-[#f0fdf4] p-4 ring-1 ring-[#bbf7d0]"
                    >
                      <p className="text-sm font-black text-[#15803d]">
                        {prediction.modelName}
                      </p>
                      <p className="mt-2 text-2xl font-black text-[#16351f]">
                        {prediction.confidence}%
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-6 text-[#4b5d50]">
                  {record.recommendation}
                </p>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(record.id)
                    }}
                    className="cursor-pointer rounded-md border border-[#fb7185]/40 bg-white px-4 py-2 text-sm font-bold text-[#be123c] transition hover:bg-[#fff1f2]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default Dashboard
