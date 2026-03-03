import { cn } from '../../lib/utils'

interface ExchangeBadgeProps {
  exchange: string
  className?: string
}

const EXCHANGE_STYLES: Record<string, string> = {
  binance: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  okx: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  hyperliquid: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  aster: 'bg-accent/15 text-accent border-accent/30',
}

export function ExchangeBadge({ exchange, className }: ExchangeBadgeProps) {
  const key = exchange.toLowerCase()
  const style = EXCHANGE_STYLES[key] ?? 'bg-muted/15 text-muted border-muted/30'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border font-data tracking-wide uppercase',
        style,
        className,
      )}
    >
      {exchange}
    </span>
  )
}
