import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BinanceExchangeData } from '../../types/api'
import { fmtPrice, fmtRate, fmtRateClass, fmtSignedPct, fmtTime, fmtUsd } from '../../lib/format'
import { ExchangeBadge } from '../widgets/ExchangeBadge'
import { StatRow } from '../widgets/StatRow'
import { cn } from '../../lib/utils'

interface BinancePanelProps {
  data: BinanceExchangeData
}

export function BinancePanel({ data }: BinancePanelProps) {
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
          <ExchangeBadge exchange="Binance" />
        </div>
        {data.ticker && (
          <span className="text-xs font-data text-muted">
            {fmtPrice(data.ticker.price)}{' '}
            <span className={cn(data.ticker.change24h >= 0 ? 'text-success' : 'text-danger')}>
              {fmtSignedPct(data.ticker.change24h)}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border">
          {data.ticker && (
            <div className="pt-3">
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Ticker</p>
              <div className="divide-y divide-border">
                <StatRow label="Price" value={fmtPrice(data.ticker.price)} />
                <StatRow
                  label="24h Change"
                  value={fmtSignedPct(data.ticker.change24h)}
                  valueClass={data.ticker.change24h >= 0 ? 'text-success' : 'text-danger'}
                />
                <StatRow label="24h Volume" value={`$${fmtUsd(data.ticker.volume24h)}`} />
              </div>
            </div>
          )}

          {data.lsRatio && data.lsRatio.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Long/Short Ratio (latest)</p>
              <div className="divide-y divide-border">
                {(() => {
                  const latest = data.lsRatio[data.lsRatio.length - 1]
                  return (
                    <>
                      <StatRow
                        label="Long"
                        value={latest.longRatio != null ? `${(latest.longRatio * 100).toFixed(1)}%` : '--'}
                        valueClass="text-success"
                      />
                      <StatRow
                        label="Short"
                        value={latest.shortRatio != null ? `${(latest.shortRatio * 100).toFixed(1)}%` : '--'}
                        valueClass="text-danger"
                      />
                      {latest.lsRatio != null && (
                        <StatRow label="L/S Ratio" value={latest.lsRatio.toFixed(3)} />
                      )}
                    </>
                  )
                })()}
              </div>
              <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-success rounded-full"
                  style={{ width: `${((data.lsRatio[data.lsRatio.length - 1].longRatio ?? 0.5) * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}

          {data.takerVolume && data.takerVolume.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Taker Buy/Sell (latest)</p>
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
                    <th className="text-right pb-1">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.fundingHistory.slice(-5).reverse().map((entry) => (
                    <tr key={entry.ts}>
                      <td className="py-1 text-muted">{fmtTime(entry.ts)}</td>
                      <td className={cn('py-1 text-right', fmtRateClass(entry.rate))}>
                        {fmtRate(entry.rate)}
                      </td>
                      <td className="py-1 text-right text-bright">
                        {entry.markPrice != null ? fmtPrice(entry.markPrice) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.oiHistory && data.oiHistory.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">
                OI History (last {Math.min(5, data.oiHistory.length)})
              </p>
              <table className="w-full text-xs font-data">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-1">Time</th>
                    <th className="text-right pb-1">OI</th>
                    <th className="text-right pb-1">OI (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.oiHistory.slice(-5).reverse().map((entry) => (
                    <tr key={entry.ts}>
                      <td className="py-1 text-muted">{fmtTime(entry.ts)}</td>
                      <td className="py-1 text-right text-bright">
                        {entry.oi != null ? fmtUsd(entry.oi) : '--'}
                      </td>
                      <td className="py-1 text-right text-bright">
                        {entry.oiValue != null ? `$${fmtUsd(entry.oiValue)}` : '--'}
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
