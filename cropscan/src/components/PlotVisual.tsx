type PlotVisualProps = {
  crop: string
  name?: string
  riskLevel?: 'low' | 'medium' | 'high'
  compact?: boolean
}

const RISK_STYLES = {
  low: 'bg-lime-soft text-leaf-700',
  medium: 'bg-sun-orange-soft text-sun-orange',
  high: 'bg-red-100 text-red-900',
}

function cropSummary(crop: string) {
  const crops = crop
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!crops.length) return 'Garden'
  if (crops.length === 1) return crops[0]
  return `${crops[0]} + ${crops.length - 1} more`
}

function riskLabel(riskLevel?: 'low' | 'medium' | 'high') {
  if (riskLevel === 'high') return 'Action needed'
  if (riskLevel === 'medium') return 'Check today'
  return 'Scout today'
}

function PlotVisual({ crop, name, riskLevel = 'low', compact = false }: PlotVisualProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-surface-2 ${
        compact ? 'min-h-36 p-3' : 'min-h-52 p-4'
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#f7fbf0_0%,#dff4df_48%,#f7d58f_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-leaf-300" />
      <div className="absolute inset-x-5 bottom-6 grid gap-2">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="crop-row-sway h-3 rounded-full bg-leaf-700/35"
            style={{ animationDelay: `${row * 110}ms` }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-1/2 h-28 w-10 -translate-x-1/2 rounded-t-full bg-canvas/50 blur-[1px]" />
      <div className="absolute right-4 top-4 h-11 w-11 rounded-full bg-sun-orange shadow-lg shadow-[#f8c94d]/30" />
      <div className="absolute left-4 top-4 max-w-[70%] rounded-md bg-white/90 px-3 py-2 shadow-sm ring-1 ring-stroke">
        <p className="truncate text-xs font-black uppercase text-leaf-700">
          {cropSummary(crop)}
        </p>
        {name ? (
          <p className="mt-1 truncate text-xs font-bold text-muted">{name}</p>
        ) : null}
      </div>
      <span
        className={`absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
          RISK_STYLES[riskLevel]
        }`}
      >
        {riskLabel(riskLevel)}
      </span>
    </div>
  )
}

export default PlotVisual
