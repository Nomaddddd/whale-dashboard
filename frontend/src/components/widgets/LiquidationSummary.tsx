import { Flame } from 'lucide-react'
import type { LiquidationData } from '../../types/api'
import { fmtUsd } from '../../lib/format'

interface LiquidationSummaryProps {
  liq: LiquidationData
}

export function LiquidationSummary({ liq }: LiquidationSummaryProps) {
  const total24h = liq.liquidation_usd_24h
  const long24h = liq.long_liquidation_usd_24h
  const short24h = liq.short_liquidation_usd_24h
  const total1h = liq.liquidation_usd_1h
  const long1h = liq.long_liquidation_usd_1h
  const short1h = liq.short_liquidation_usd_1h

  const longPct24h =
    total24h && long24h ? Math.round((long24h / total24h) * 100) : null
  const shortPct24h =
    total24h && short24h ? Math.round((short24h / total24h) * 100) : null

  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
        <Flame size={12} className="text-danger" />
        Liquidations
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted mb-2">24h Total</p>
          <p className="text-lg font-data font-semibold text-bright">${fmtUsd(total24h)}</p>
          {long24h != null && short24h != null && (
            <div className="mt-2 flex gap-3 text-xs font-data">
              <span className="text-danger">
                L: ${fmtUsd(long24h)}
                {longPct24h != null && (
                  <span className="text-muted ml-1">({longPct24h}%)</span>
                )}
              </span>
              <span className="text-success">
                S: ${fmtUsd(short24h)}
                {shortPct24h != null && (
                  <span className="text-muted ml-1">({shortPct24h}%)</span>
                )}
              </span>
            </div>
          )}
          {total24h != null && long24h != null && short24h != null && (
            <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-danger rounded-full"
                style={{ width: `${longPct24h ?? 50}%` }}
              />
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted mb-2">1h Total</p>
          <p className="text-lg font-data font-semibold text-bright">${fmtUsd(total1h)}</p>
          {long1h != null && short1h != null && (
            <div className="mt-2 flex gap-3 text-xs font-data">
              <span className="text-danger">L: ${fmtUsd(long1h)}</span>
              <span className="text-success">S: ${fmtUsd(short1h)}</span>
            </div>
          )}
          {liq.liquidation_usd_4h != null && (
            <p className="text-xs text-muted mt-2 font-data">
              4h: ${fmtUsd(liq.liquidation_usd_4h)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
