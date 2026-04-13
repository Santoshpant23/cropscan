import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import {
  clearUserAnalyses,
  deleteAnalysis,
  getUserAnalyses,
  updateAnalysisNotes,
} from '../lib/storage'
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
  const { user } = useAuth()
  const [records, setRecords] = useState<AnalysisRecord[]>(() =>
    user ? getUserAnalyses(user.email) : [],
  )
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(records.map((record) => [record.id, record.notes])),
  )

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

  function handleDelete(id: string) {
    deleteAnalysis(id)
    setRecords((currentRecords) => currentRecords.filter((record) => record.id !== id))
  }

  function handleClear() {
    if (!user) return
    clearUserAnalyses(user.email)
    setRecords([])
    setDraftNotes({})
  }

  function handleSaveNote(id: string) {
    const notes = draftNotes[id] ?? ''
    updateAnalysisNotes(id, notes)
    setRecords((currentRecords) =>
      currentRecords.map((record) => (record.id === id ? { ...record, notes } : record)),
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#15803d]">Saved analyses</p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5d50]">
            Review past scans, compare model confidence, add notes, and remove
            records as the field history grows.
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
            onClick={handleClear}
            disabled={records.length === 0}
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

      {records.length === 0 ? (
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
          {records.map((record) => (
            <article
              key={record.id}
              className="grid gap-5 rounded-lg border border-[#14532d]/10 bg-white p-4 shadow-sm lg:grid-cols-[220px_1fr]"
            >
              <img
                src={record.imageDataUrl}
                alt={`${record.predictions[0].crop} leaf`}
                className="h-56 w-full rounded-md object-cover lg:h-full"
              />

              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#4b5d50]">
                      {formatDate(record.createdAt)} · {record.fileName}
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-[#16351f]">
                      {record.predictions[0].crop} - {record.predictions[0].disease}
                    </h2>
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
                    <div key={prediction.modelName} className="rounded-lg bg-[#f0fdf4] p-4 ring-1 ring-[#bbf7d0]">
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

                <div className="mt-4">
                  <label htmlFor={`notes-${record.id}`} className="text-sm font-black text-[#16351f]">
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
                    className="mt-2 w-full resize-none rounded-md border border-[#14532d]/15 bg-white px-3 py-2 text-sm text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
                    placeholder="Add field conditions, treatment decision, or follow-up date"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveNote(record.id)}
                    className="cursor-pointer rounded-md bg-[#16351f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#166534]"
                  >
                    Save note
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record.id)}
                    className="cursor-pointer rounded-md border border-[#fb7185]/40 bg-white px-4 py-2 text-sm font-bold text-[#be123c] transition hover:bg-[#fff1f2]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Dashboard
