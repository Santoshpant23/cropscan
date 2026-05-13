import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  Footprints,
  Lightbulb,
  Plus,
  ScanLine,
  Sparkles,
  Sprout,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getPlotTodayRequest, getPlotsRequest } from '../lib/api'
import { formatTemperature, weatherLabel } from '../lib/format'
import type { PlotRecord, PlotTodayCard } from '../types'

const HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80'

const PUBLIC_STATS: Array<{ value: string; label: string }> = [
  { value: '99%', label: 'Accuracy' },
  { value: '0.5s', label: 'Scan speed' },
  { value: '12k+', label: 'Species' },
]

const MONTHLY_TIPS = [
  'Check stored tools, clean trays, and plan the first beds before the rush starts.',
  'Start cool-season planning and inspect overwintered plants after warm afternoons.',
  'Watch cold nights closely. Young leaves can look healthy in the day and burn overnight.',
  'Scout seedlings twice a week. Early leaf spots are easier to handle than spread later.',
  'Walk tomatoes and peppers after rain. Wet leaves plus cool nights can raise disease pressure.',
  'Water early and keep leaves dry where possible. Heat and humidity can move problems fast.',
  'Check leaf undersides for mites, eggs, and early pest pressure before spraying anything.',
  'Harvest often and remove damaged fruit. Rot and insects build quickly in late summer.',
  'Thin dense growth and keep airflow open as nights cool and dew stays longer.',
  'Watch first frost forecasts and finish late-season harvest before a hard freeze.',
  'Clean up diseased debris. Leaving it in the bed can carry problems into next season.',
  'Review notes from the year and mark which beds had repeated disease pressure.',
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || 'grower'
}

function PublicHomePage() {
  return (
    <div>
      <section className="px-6 pt-4 pb-10 sm:pt-8 lg:mx-auto lg:max-w-5xl lg:px-8 lg:pt-16">
        <div className="overflow-hidden rounded-xl bg-forest-700 text-white">
          <div
            className="relative aspect-[5/4] sm:aspect-[16/9] lg:aspect-[2/1]"
            style={{
              backgroundImage: `url('${HERO_IMAGE_URL}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-forest-900/30 via-forest-900/55 to-forest-900/95" />
            <div className="relative flex h-full flex-col justify-end p-6 sm:p-10">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-900">
                <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                AI field diagnostics
              </span>
              <h1 className="font-display mt-4 text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
                The Agronomist&apos;s Smart Clipboard.
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-canvas/90 sm:text-lg">
                Diagnose field health with pinpoint accuracy in seconds. Your
                expert companion for every row.
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-3 sm:gap-4 sm:p-8">
            {PUBLIC_STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-lg bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur"
              >
                <p className="font-display text-3xl font-bold tracking-tight">
                  {value}
                </p>
                <p className="mt-1 text-sm font-medium text-canvas/90">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Built for outdoor use — high contrast, 56px touch targets, works
            offline.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-[0.99]"
            >
              Create account
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <Link
              to="/login"
              className="crop-touch inline-flex items-center justify-center rounded-md border border-stroke bg-surface px-6 text-base font-bold text-forest-700 transition hover:bg-surface-2"
            >
              Login to scan
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

type Risk = NonNullable<PlotTodayCard['riskLevel']>

function plotStatus(card?: PlotTodayCard): {
  label: string
  Icon: typeof CheckCircle2
  className: string
} {
  const risk: Risk = card?.riskLevel ?? 'low'
  if (risk === 'high') {
    return {
      label: 'Action needed',
      Icon: AlertTriangle,
      className: 'bg-red-50 text-danger ring-red-200',
    }
  }
  if (risk === 'medium') {
    return {
      label: 'Needs review',
      Icon: AlertTriangle,
      className: 'bg-sun-orange-soft text-sun-orange ring-sun-orange/40',
    }
  }
  return {
    label: 'Healthy',
    Icon: CheckCircle2,
    className: 'bg-leaf-300/30 text-leaf-700 ring-leaf-300/50',
  }
}

function GrowerHomePage() {
  const { token, user } = useAuth()
  const [plots, setPlots] = useState<PlotRecord[]>([])
  const [todayCards, setTodayCards] = useState<Record<string, PlotTodayCard>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    const activeToken = token
    let isMounted = true

    async function loadToday() {
      setIsLoading(true)
      setError('')
      try {
        const serverPlots = await getPlotsRequest(activeToken)
        const cardEntries = await Promise.all(
          serverPlots.map(async (plot) => {
            try {
              const card = await getPlotTodayRequest(plot.id, activeToken)
              return [plot.id, card] as const
            } catch {
              return [plot.id, null] as const
            }
          }),
        )
        if (!isMounted) return
        setPlots(serverPlots)
        setTodayCards(
          Object.fromEntries(
            cardEntries.filter((entry): entry is readonly [string, PlotTodayCard] =>
              Boolean(entry[1]),
            ),
          ),
        )
      } catch (caughtError) {
        if (!isMounted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not load today cards.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadToday()
    return () => {
      isMounted = false
    }
  }, [token])

  const tip = MONTHLY_TIPS[new Date().getMonth()]
  const attentionCount = useMemo(
    () =>
      Object.values(todayCards).filter(
        (card) => card.riskLevel === 'high' || card.riskLevel === 'medium',
      ).length,
    [todayCards],
  )
  const conditionsCopy =
    plots.length === 0
      ? 'Start by adding your first growing spot.'
      : attentionCount === 0
        ? 'Conditions are optimal for field scouting today.'
        : `${attentionCount} plot${attentionCount === 1 ? '' : 's'} need attention today.`

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <header className="crop-fade-up">
        <p className="text-xs font-bold uppercase tracking-wider text-leaf-700">
          Today on your plots
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
          {greeting()}, {firstName(user?.name)}.
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted">
          {conditionsCopy}
        </p>
      </header>

      <div className="crop-fade-up mt-6 grid grid-cols-3 gap-3">
        <QuickAction to="/scan" label="Scan a leaf" Icon={ScanLine} primary />
        <QuickAction to="/walk" label="Walk a row" Icon={Footprints} />
        <QuickAction to="/plots?new=1" label="Add plot" Icon={Plus} />
      </div>

      {error ? (
        <p
          role="alert"
          className="crop-fade-up mt-6 rounded-md bg-sun-orange-soft px-4 py-3 text-sm font-bold text-sun-orange ring-1 ring-sun-orange/40"
        >
          {error}
        </p>
      ) : null}

      <div className="crop-fade-up mt-8 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest-900">
          Your Plots
        </h2>
        {plots.length > 0 ? (
          <Link
            to="/plots"
            className="inline-flex items-center gap-1 text-sm font-bold text-leaf-700 hover:text-forest-900"
          >
            View all
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {isLoading ? (
          <>
            <PlotCardSkeleton />
            <PlotCardSkeleton />
          </>
        ) : plots.length === 0 ? (
          <EmptyPlotState />
        ) : (
          plots.map((plot, index) => (
            <PlotCard
              key={plot.id}
              plot={plot}
              card={todayCards[plot.id]}
              index={index}
            />
          ))
        )}
      </div>

      <div className="crop-fade-up mt-8 rounded-lg border border-stroke bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-leaf-300/30 text-leaf-700">
            <Lightbulb className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-xs font-bold uppercase tracking-wider text-leaf-700">
            Today&apos;s field tip
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">{tip}</p>
      </div>
    </section>
  )
}

function QuickAction({
  to,
  label,
  Icon,
  primary,
}: {
  to: string
  label: string
  Icon: typeof ScanLine
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={[
        'crop-touch flex flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-3 text-center text-xs font-bold transition active:scale-[0.98]',
        primary
          ? 'bg-lime text-forest-900 shadow-sm hover:bg-lime-soft'
          : 'bg-surface text-forest-700 ring-1 ring-stroke hover:bg-surface-2',
      ].join(' ')}
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
      {label}
    </Link>
  )
}

function PlotCard({
  plot,
  card,
  index,
}: {
  plot: PlotRecord
  card?: PlotTodayCard
  index: number
}) {
  const status = plotStatus(card)
  const StatusIcon = status.Icon
  const tempLow = formatTemperature(card?.signals.tonightLowF)
  const isFrostRisk =
    card?.signals.tonightLowF !== undefined &&
    card?.signals.tonightLowF !== null &&
    card.signals.tonightLowF <= 40
  const rainProbability = card?.signals.rainProbability ?? null
  const rainLikely = rainProbability !== null && rainProbability >= 0.6
  const isHeat = card?.signals.heatStress ?? false
  const SourceIcon = isHeat ? ThermometerSun : Sun
  return (
    <Link
      to={`/plots/${plot.id}`}
      className="crop-fade-up block rounded-lg border border-stroke bg-surface p-4 transition hover:shadow-sm"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {plot.crop}
          </p>
          <h3 className="font-display mt-1 truncate text-lg font-bold text-forest-900">
            {plot.name}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
          {status.label}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted line-clamp-2">
        {card?.headline ?? 'Tap for the latest scouting prompt.'}
      </p>

      {card ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SignalPill
            Icon={ThermometerSnowflake}
            label="Low tonight"
            value={tempLow ?? '—'}
            tone={isFrostRisk ? 'frost' : 'leaf'}
          />
          <SignalPill
            Icon={CloudRain}
            label="Rain"
            value={
              rainProbability !== null
                ? `${Math.round(rainProbability * 100)}%`
                : '—'
            }
            tone={rainLikely ? 'rain' : 'muted'}
          />
          <SignalPill
            Icon={SourceIcon}
            label={isHeat ? 'Heat' : 'Source'}
            value={
              isHeat
                ? formatTemperature(card.signals.todayHighF) ?? '—'
                : weatherLabel(card.signals.source)
            }
            tone={isHeat ? 'heat' : 'muted'}
          />
        </div>
      ) : null}

      <span
        className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-leaf-700 hover:text-forest-900"
      >
        View details
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </Link>
  )
}

const SIGNAL_TONE_CLASSES: Record<string, string> = {
  leaf: 'bg-leaf-300/20 text-leaf-700',
  frost: 'bg-blue-50 text-blue-700',
  rain: 'bg-blue-50 text-blue-700',
  heat: 'bg-sun-orange-soft text-sun-orange',
  muted: 'bg-surface-2 text-muted',
}

function SignalPill({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Sun
  label: string
  value: string
  tone: keyof typeof SIGNAL_TONE_CLASSES
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-md px-2.5 py-2 ${SIGNAL_TONE_CLASSES[tone]}`}
    >
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </span>
      <span className="truncate text-sm font-bold">{value}</span>
    </div>
  )
}

function PlotCardSkeleton() {
  return (
    <div className="rounded-lg border border-stroke bg-surface p-4">
      <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-surface-2" />
    </div>
  )
}

function EmptyPlotState() {
  return (
    <div className="rounded-lg border border-stroke bg-surface p-6 text-center lg:col-span-2">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-leaf-300/30 text-leaf-700">
        <Sprout className="h-6 w-6" strokeWidth={2} />
      </span>
      <h3 className="font-display mt-4 text-xl font-bold tracking-tight text-forest-900">
        Add your first plot
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Track scans against a real bed, row, or field — and get weather-aware
        guidance each morning.
      </p>
      <Link
        to="/plots?new=1"
        className="crop-touch mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-lime px-6 text-sm font-bold text-forest-900 shadow-sm transition hover:bg-lime-soft"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        Add a plot
      </Link>
    </div>
  )
}

function HomePage() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <GrowerHomePage /> : <PublicHomePage />
}

export default HomePage
