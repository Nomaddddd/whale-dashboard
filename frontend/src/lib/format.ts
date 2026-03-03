export function fmtUsd(value?: number | null): string {
  if (value == null) return '--'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

export function fmtPrice(value?: number | null): string {
  if (value == null) return '--'
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (value >= 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(6)}`
}

export function fmtRate(value?: number | null): string {
  if (value == null) return '--'
  const pct = value * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(4)}%`
}

export function fmtRateClass(value?: number | null): string {
  if (value == null) return 'text-muted'
  if (value > 0.0001) return 'text-danger'
  if (value < -0.0001) return 'text-success'
  return 'text-muted'
}

export function fmtSignedPct(value?: number | null): string {
  if (value == null) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function fmtTime(timestamp?: number): string {
  if (!timestamp) return '--'
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  return new Date(ms).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
