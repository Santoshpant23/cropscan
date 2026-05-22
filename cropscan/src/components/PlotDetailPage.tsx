import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  History,
  Leaf,
  ListChecks,
  ScanLine,
  ShieldAlert,
  ThermometerSnowflake,
  ThermometerSun,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  getPlotCareGuideRequest,
  getPlotRecentScansRequest,
  getPlotRequest,
  getPlotTodayRequest,
} from '../lib/api'
import { formatTemperature, weatherLabel } from '../lib/format'
import type {
  PlotCareGuide,
  PlotDayForecast,
  PlotRecentScan,
  PlotRecord,
  PlotTodayCard,
} from '../types'
import PlotVisual from './PlotVisual'

const RISK_STYLES = {
  low: {
    label: 'Healthy',
    Icon: CheckCircle2,
    className: 'bg-leaf-300/30 text-leaf-700 ring-leaf-300/50',
  },
  medium: {
    label: 'Needs review',
    Icon: AlertTriangle,
    className: 'bg-sun-orange-soft text-sun-orange ring-sun-orange/40',
  },
  high: {
    label: 'Action needed',
    Icon: AlertTriangle,
    className: 'bg-red-50 text-danger ring-red-200',
  },
}

function PlotDetailPage() {
  const { plotId } = useParams()
  const { token } = useAuth()
  const [plot, setPlot] = useState<PlotRecord | null>(null)
  const [todayCard, setTodayCard] = useState<PlotTodayCard | null>(null)
  const [careGuide, setCareGuide] = useState<PlotCareGuide | null>(null)
  const [recentScans, setRecentScans] = useState<PlotRecentScan[]>([])
  const [needsReviewCount, setNeedsReviewCount] = useState(0)
  const [totalScanCount, setTotalScanCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !plotId) return
    const activePlotId = plotId
    const activeToken = token
    let isMounted = true

    async function loadPlotDetail() {
      setIsLoading(true)
      setError('')
      try {
        const [plotResponse, todayResponse, careResponse, scansResponse] =
          await Promise.all([
            getPlotRequest(activePlotId, activeToken),
            getPlotTodayRequest(activePlotId, activeToken),
            getPlotCareGuideRequest(activePlotId, activeToken),
            getPlotRecentScansRequest(activePlotId, activeToken, 5).catch(
              () => null,
            ),
          ])
        if (!isMounted) return
        setPlot(plotResponse)
        setTodayCard(todayResponse)
        setCareGuide(careResponse)
        if (scansResponse) {
          setRecentScans(scansResponse.scans)
          setNeedsReviewCount(scansResponse.needsReviewCount)
          setTotalScanCount(scansResponse.totalCount)
        }
      } catch (caughtError) {
        if (!isMounted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not load plot care guide.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPlotDetail()
    return () => {
      isMounted = false
    }
  }, [plotId, token])

  const risk = RISK_STYLES[careGuide?.riskLevel ?? todayCard?.riskLevel ?? 'low']
  const RiskIcon = risk.Icon
  const signals = careGuide?.signals ?? todayCard?.signals
  const signalCards = useMemo(() => {
    if (!signals) return []
    return [
      {
        label: 'Low tonight',
        value: formatTemperature(signals.tonightLowF) ?? 'Not available',
        Icon: ThermometerSnowflake,
      },
      {
        label: 'High today',
        value: formatTemperature(signals.todayHighF) ?? 'Not available',
        Icon: ThermometerSun,
      },
      {
        label: 'Rain chance',
        value: `${Math.round(signals.rainProbability * 100)}%`,
        Icon: CloudRain,
      },
      {
        label: 'Weather source',
        value: weatherLabel(signals.source),
        Icon: CalendarClock,
      },
    ]
  }, [signals])

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-leaf-700 transition hover:text-forest-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Back to today
      </Link>

      {error ? (
        <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <PlotDetailSkeleton />
      ) : plot && careGuide ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm sm:p-6">
            <PlotVisual crop={plot.crop} name={plot.name} />
            <div className="mt-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-leaf-700">
                  {plot.crop}
                </p>
                <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-forest-900">
                  {plot.name}
                </h1>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 ${risk.className}`}
              >
                <RiskIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                {risk.label}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              {plot.locationLabel || 'Saved map point'} · about{' '}
              {Math.round(plot.areaSqFt)} sq ft
            </p>
            {plot.notes ? (
              <div className="mt-4 rounded-lg bg-canvas p-4 ring-1 ring-stroke">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-forest-700">{plot.notes}</p>
              </div>
            ) : null}
          </aside>

          <div className="space-y-5">
            <section className="crop-fade-up rounded-2xl bg-forest-900 p-6 text-white shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">
                Plant care guide
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight">
                {careGuide.headline}
              </h2>
              <p className="mt-4 text-base leading-7 text-canvas/90">
                {careGuide.problemSummary}
              </p>
            </section>

            {needsReviewCount > 0 ? (
              <section className="crop-fade-up rounded-2xl border border-sun-orange/40 bg-sun-orange-soft p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-sun-orange ring-1 ring-sun-orange/30">
                    <AlertTriangle className="h-5 w-5" strokeWidth={2.4} />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-sun-orange">
                      Needs attention
                    </p>
                    <h2 className="font-display mt-1 text-xl font-bold tracking-tight text-forest-900">
                      {needsReviewCount === 1
                        ? '1 recent scan needs review.'
                        : `${needsReviewCount} recent scans need review.`}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-forest-700">
                      Re-scan the same leaves in better light, or open each scan
                      below to read the suggested next step.
                    </p>
                    <Link
                      to={`/scan?plotId=${plot.id}`}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-forest-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-forest-700"
                    >
                      <ScanLine className="h-4 w-4" strokeWidth={2.4} />
                      Re-scan this plot
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                Icon={ListChecks}
                title="What to do"
                eyebrow="Step by step"
              />
              <ol className="mt-5 space-y-3">
                {careGuide.careSteps.map((step, index) => (
                  <li key={step} className="grid grid-cols-[34px_1fr] gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-bold text-forest-900">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-6 text-forest-700">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm">
                <SectionHeader Icon={Leaf} title="Watch for" eyebrow="Scout these" />
                <BulletList items={careGuide.watchFor} />
              </section>

              <section className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm">
                <SectionHeader Icon={ShieldAlert} title="Avoid" eyebrow="Do not rush" />
                <BulletList items={careGuide.avoid} />
              </section>
            </div>

            <section className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader Icon={CalendarClock} title="Today signals" eyebrow="Weather" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {signalCards.map(({ label, value, Icon }) => (
                  <div key={label} className="rounded-lg bg-canvas p-4 ring-1 ring-stroke">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                      <Icon className="h-4 w-4" strokeWidth={2.4} />
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-bold text-forest-900">{value}</p>
                  </div>
                ))}
              </div>
              {signals?.nextDays && signals.nextDays.length > 0 ? (
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Next few days
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {signals.nextDays.slice(0, 3).map((day) => (
                      <DayForecastCard key={day.date} day={day} />
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-5 rounded-lg bg-leaf-300/20 p-4 ring-1 ring-leaf-300/40">
                <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">
                  Next check
                </p>
                <p className="mt-2 text-sm leading-6 text-forest-700">
                  {careGuide.nextCheck}
                </p>
              </div>
            </section>

            <section className="crop-fade-up rounded-2xl border border-stroke bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                Icon={History}
                title="Recent scans"
                eyebrow={
                  totalScanCount > 0
                    ? `${totalScanCount} scan${totalScanCount === 1 ? '' : 's'} on file`
                    : 'No scans yet'
                }
              />
              {recentScans.length === 0 ? (
                <p className="mt-4 rounded-lg bg-canvas p-4 text-sm leading-6 text-muted ring-1 ring-stroke">
                  No scans linked to this plot yet. Tap the scan button below
                  and a fresh diagnosis will land here.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recentScans.map((scan) => (
                    <RecentScanRow key={scan.id} scan={scan} />
                  ))}
                </ul>
              )}
            </section>

            <Link
              to={`/scan?plotId=${plot.id}`}
              className="crop-touch inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft"
            >
              <ScanLine className="h-5 w-5" strokeWidth={2.4} />
              Scan a leaf from this plot
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function SectionHeader({
  Icon,
  title,
  eyebrow,
}: {
  Icon: typeof Leaf
  title: string
  eyebrow: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-leaf-300/25 text-leaf-700">
        <Icon className="h-5 w-5" strokeWidth={2.3} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-leaf-700">
          {eyebrow}
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-forest-900">
          {title}
        </h2>
      </div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-muted">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-leaf-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function DayForecastCard({ day }: { day: PlotDayForecast }) {
  const dateLabel = useMemo(() => {
    const parsed = new Date(`${day.date}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return day.date
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }, [day.date])
  const highlight =
    day.summary.toLowerCase().includes('frost') ||
    day.summary.toLowerCase().includes('severe heat') ||
    day.summary.toLowerCase().includes('rain expected')
  return (
    <div
      className={`rounded-lg p-3 ring-1 ${
        highlight
          ? 'bg-sun-orange-soft text-forest-900 ring-sun-orange/40'
          : 'bg-canvas text-forest-700 ring-stroke'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {dateLabel}
      </p>
      <p className="font-display mt-1 text-base font-bold tracking-tight text-forest-900">
        {day.summary}
      </p>
      <p className="mt-2 text-xs font-bold text-muted">
        {formatTemperature(day.lowF) ?? '—'} / {formatTemperature(day.highF) ?? '—'}
        {' · '}
        {Math.round(day.rainProbability * 100)}% rain
      </p>
    </div>
  )
}

const SCAN_STATUS_STYLES: Record<string, string> = {
  'High confidence': 'bg-leaf-300/30 text-leaf-700 ring-leaf-300/50',
  'Review needed': 'bg-sun-orange-soft text-sun-orange ring-sun-orange/40',
}

function RecentScanRow({ scan }: { scan: PlotRecentScan }) {
  const date = useMemo(() => {
    const parsed = new Date(scan.createdAt)
    if (Number.isNaN(parsed.getTime())) return scan.createdAt
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [scan.createdAt])
  const statusClass =
    SCAN_STATUS_STYLES[scan.status] ?? 'bg-canvas text-muted ring-stroke'
  const condition = scan.condition || '—'
  const crop = scan.cropType || '—'
  return (
    <li className="rounded-lg border border-stroke bg-canvas p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold tracking-tight text-forest-900">
            {crop}
          </p>
          <p className="mt-1 truncate text-sm font-bold text-forest-700">
            {condition}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
            {date}
            {typeof scan.confidencePercent === 'number'
              ? ` · ${Math.round(scan.confidencePercent)}% confident`
              : ''}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${statusClass}`}
        >
          {scan.diagnosisStateLabel || scan.status}
        </span>
      </div>
    </li>
  )
}

function PlotDetailSkeleton() {
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
      <div className="space-y-5">
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  )
}

export default PlotDetailPage
