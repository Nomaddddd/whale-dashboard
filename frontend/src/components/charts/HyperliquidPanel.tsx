import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { HyperliquidExchangeData } from '../../types/api'
import { fmtPrice, fmtRate, fmtRateClass, fmtTime, fmtUsd } from '../../lib/format'
import { ExchangeBadge } from '../widgets/ExchangeBadge'
import { StatRow } from '../widgets/StatRow'
import { cn } from '../../lib/utils'

interface HyperliquidPanelProps {
  data: HyperliquidExchangeData
}

export function HyperliquidPanel({ data }: HyperliquidPanelProps) {
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
          <ExchangeBadge exchange="Hyperliquid" />
        </div>
        {data.market?.funding != null && (
          <span className={cn('text-xs font-data', fmtRateClass(data.market.funding))}>
            FR: {fmtRate(data.market.funding)}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border">
          {data.market && (
            <div className="pt-3">
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Market Stats</p>
              <div className="divide-y divide-border">
                <StatRow label="Price" value={fmtPrice(data.market.price)} />
                <StatRow
                  label="Funding"
                  value={fmtRate(data.market.funding)}
                  valueClass={fmtRateClass(data.market.funding)}
                />
                {data.market.openInterest != null && (
                  <StatRow label="OI" value={fmtUsd(data.market.openInterest)} />
                )}
                {data.market.oiUsd != null && (
                  <StatRow label="OI (USD)" value={`$${fmtUsd(data.market.oiUsd)}`} />
                )}
                {data.market.volume24h != null && (
                  <StatRow label="24h Volume" value={`$${fmtUsd(data.market.volume24h)}`} />
                )}
              </div>
            </div>
          )}

          {data.recentTrades && data.recentTrades.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">
                Recent Large Trades ({data.recentTrades.length})
              </p>
              <table className="w-full text-xs font-data">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-1">Side</th>
                    <th className="text-right pb-1">Price</th>
                    <th className="text-right pb-1">Size</th>
                    <th className="text-right pb-1">USD</th>
                    <th className="text-right pb-1">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentTrades.slice(0, 10).map((trade) => (
                    <tr key={`${trade.ts}-${trade.price}-${trade.size}`}>
                      <td
                        className={cn(
                          'py-1 font-semibold',
                          trade.side === 'B' ? 'text-success' : 'text-danger',
                        )}
                      >
                        {trade.side === 'B' ? 'BUY' : 'SELL'}
                      </td>
                      <td className="py-1 text-right text-bright">${trade.price.toLocaleString()}</td>
                      <td className="py-1 text-right text-bright">{fmtUsd(trade.size)}</td>
                      <td className="py-1 text-right text-bright">${fmtUsd(trade.usd)}</td>
                      <td className="py-1 text-right text-muted">{fmtTime(trade.ts)}</td>
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
