import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CloudRain,
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
  getPlotRequest,
  getPlotTodayRequest,
} from '../lib/api'
import { formatTemperature, weatherLabel } from '../lib/format'
import type { PlotCareGuide, PlotRecord, PlotTodayCard } from '../types'
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
        const [plotResponse, todayResponse, careResponse] = await Promise.all([
          getPlotRequest(activePlotId, activeToken),
          getPlotTodayRequest(activePlotId, activeToken),
          getPlotCareGuideRequest(activePlotId, activeToken),
        ])
        if (!isMounted) return
        setPlot(plotResponse)
        setTodayCard(todayResponse)
        setCareGuide(careResponse)
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
              <div className="mt-5 rounded-lg bg-leaf-300/20 p-4 ring-1 ring-leaf-300/40">
                <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">
                  Next check
                </p>
                <p className="mt-2 text-sm leading-6 text-forest-700">
                  {careGuide.nextCheck}
                </p>
              </div>
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
