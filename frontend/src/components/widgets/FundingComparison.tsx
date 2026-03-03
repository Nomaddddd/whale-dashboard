import type { FundingComparison as FundingComparisonData } from '../../types/api'
import { fmtRate, fmtRateClass } from '../../lib/format'
import { cn } from '../../lib/utils'

interface FundingComparisonProps {
  comparison: FundingComparisonData
}

const EXCHANGES = [
  { key: 'binance' as const, label: 'Binance', color: 'text-yellow-400' },
  { key: 'okx' as const, label: 'OKX', color: 'text-sky-400' },
  { key: 'hyperliquid' as const, label: 'Hyperliquid', color: 'text-violet-400' },
  { key: 'aster' as const, label: 'Aster', color: 'text-accent' },
]

export function FundingComparison({ comparison }: FundingComparisonProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-3">
        Funding Rate Comparison
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EXCHANGES.map(({ key, label, color }) => {
          const rate = comparison[key]
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1"
            >
              <span className={cn('text-xs font-medium', color)}>{label}</span>
              <span className={cn('text-lg font-data font-semibold', fmtRateClass(rate))}>
                {fmtRate(rate)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
