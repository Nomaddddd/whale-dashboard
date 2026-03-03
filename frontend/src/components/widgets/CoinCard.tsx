import { TrendingDown, TrendingUp } from 'lucide-react'
import type { DashboardCoin } from '../../types/api'
import { fmtPrice, fmtRate, fmtRateClass, fmtSignedPct, fmtUsd } from '../../lib/format'
import { cn } from '../../lib/utils'

interface CoinCardProps {
  symbol: string
  coin: DashboardCoin
  selected: boolean
  onClick: () => void
}

function OiChangeBadge({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null
  const positive = value > 0
  return (
    <span className={cn('text-xs font-data px-1 py-0.5 rounded', positive ? 'text-success' : 'text-danger')}>
      {label} {fmtSignedPct(value)}
    </span>
  )
}

export function CoinCard({ symbol, coin, selected, onClick }: CoinCardProps) {
  const change24h = coin.change24h
  const isPositive = (change24h ?? 0) > 0
  const isNegative = (change24h ?? 0) < 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border p-3 flex flex-col gap-2 transition-all duration-200',
        'hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98]',
        selected
          ? 'border-accent/70 bg-accent/8 ring-1 ring-accent/30'
          : 'border-border bg-card',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-semibold', selected ? 'text-accent' : 'text-bright')}>
          {symbol}
        </span>
        {change24h != null && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-data',
              isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-muted',
            )}
          >
            {isPositive ? (
              <TrendingUp size={10} />
            ) : isNegative ? (
              <TrendingDown size={10} />
            ) : null}
            {fmtSignedPct(change24h)}
          </span>
        )}
      </div>

      <div className="font-data text-base font-medium text-bright">
        {fmtPrice(coin.price)}
      </div>

      {coin.oi && (
        <div className="flex flex-col gap-0.5">
          <div className="text-xs text-muted">
            OI: <span className="text-bright font-data">${fmtUsd(coin.oi.usd)}</span>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <OiChangeBadge label="5m" value={coin.oi.change5m} />
            <OiChangeBadge label="1h" value={coin.oi.change1h} />
            <OiChangeBadge label="4h" value={coin.oi.change4h} />
            <OiChangeBadge label="24h" value={coin.oi.change24h} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border">
        {coin.fundingRate != null ? (
          <span className={cn('text-xs font-data', fmtRateClass(coin.fundingRate))}>
            FR: {fmtRate(coin.fundingRate)}
          </span>
        ) : (
          <span className="text-xs text-muted">FR: --</span>
        )}
        {coin.liquidation?.liquidation_usd_24h != null && (
          <span className="text-xs font-data text-muted">
            Liq: ${fmtUsd(coin.liquidation.liquidation_usd_24h)}
          </span>
        )}
      </div>
    </button>
  )
}
