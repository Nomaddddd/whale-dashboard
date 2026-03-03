import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { OkxExchangeData } from '../../types/api'
import { fmtRate, fmtRateClass, fmtTime, fmtUsd } from '../../lib/format'
import { ExchangeBadge } from '../widgets/ExchangeBadge'
import { StatRow } from '../widgets/StatRow'
import { cn } from '../../lib/utils'

interface OkxPanelProps {
  data: OkxExchangeData
}

export function OkxPanel({ data }: OkxPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
          <ExchangeBadge exchange="OKX" />
        </div>
        {data.funding?.rate != null && (
          <span className={cn('text-xs font-data', fmtRateClass(data.funding.rate))}>
            FR: {fmtRate(data.funding.rate)}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border">
          {data.oi && (
            <div className="pt-3">
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Open Interest</p>
              <div className="divide-y divide-border">
                {data.oi.oi != null && <StatRow label="OI (Contracts)" value={fmtUsd(data.oi.oi)} />}
                {data.oi.oiUsd != null && <StatRow label="OI (USD)" value={`$${fmtUsd(data.oi.oiUsd)}`} />}
              </div>
            </div>
          )}

          {data.lsRatio && data.lsRatio.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Long/Short Ratio (latest)</p>
              {(() => {
                const latest = data.lsRatio[data.lsRatio.length - 1]
                return (
                  <div className="divide-y divide-border">
                    <StatRow label="L/S Ratio" value={latest.ratio != null ? latest.ratio.toFixed(4) : '--'} />
                  </div>
                )
              })()}
            </div>
          )}

          {data.takerVolume && data.takerVolume.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Taker Volume (latest)</p>
              <div className="divide-y divide-border">
                {(() => {
                  const latest = data.takerVolume[data.takerVolume.length - 1]
                  return (
                    <>
                      <StatRow label="Buy/Sell Ratio" value={latest.buySellRatio != null ? latest.buySellRatio.toFixed(4) : '--'} />
                      {latest.buyVol != null && (
                        <StatRow label="Buy Vol" value={`$${fmtUsd(latest.buyVol)}`} valueClass="text-success" />
                      )}
                      {latest.sellVol != null && (
                        <StatRow label="Sell Vol" value={`$${fmtUsd(latest.sellVol)}`} valueClass="text-danger" />
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {data.liquidations && data.liquidations.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">
                Recent Liquidations ({data.liquidations.length})
              </p>
              <table className="w-full text-xs font-data">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-1">Side</th>
                    <th className="text-right pb-1">Price</th>
                    <th className="text-right pb-1">Size</th>
                    <th className="text-right pb-1">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.liquidations.slice(0, 8).map((entry) => (
                    <tr key={`${entry.ts}-${entry.side}-${entry.price}`}>
                      <td className={cn('py-1', entry.side === 'long' ? 'text-danger' : 'text-success')}>
                        {entry.side.toUpperCase()}
                      </td>
                      <td className="py-1 text-right text-bright">${entry.price.toLocaleString()}</td>
                      <td className="py-1 text-right text-bright">{fmtUsd(entry.size)}</td>
                      <td className="py-1 text-right text-muted">{fmtTime(entry.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.fundingHistory && data.fundingHistory.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">
                Funding History (last {Math.min(5, data.fundingHistory.length)})
              </p>
              <table className="w-full text-xs font-data">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-1">Time</th>
                    <th className="text-right pb-1">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.fundingHistory.slice(-5).reverse().map((entry) => (
                    <tr key={entry.ts}>
                      <td className="py-1 text-muted">{fmtTime(entry.ts)}</td>
                      <td className={cn('py-1 text-right', fmtRateClass(entry.rate))}>
                        {fmtRate(entry.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
