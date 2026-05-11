export function formatTemperature(value?: number | null) {
  if (value === null || value === undefined) return null
  return `${Math.round(value)}°F`
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function weatherLabel(source?: string) {
  return source === 'Open-Meteo' ? 'Live forecast' : 'Seasonal estimate'
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
