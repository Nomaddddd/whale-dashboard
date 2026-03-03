import { Activity, RefreshCw } from 'lucide-react'
import { fmtTime } from '../../lib/format'
import { cn } from '../../lib/utils'

const TOP_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'SUI', 'DOT', 'PEPE', 'NEAR', 'WIF', 'ARB', 'OP',
  'APT', 'AAVE', 'UNI', 'INJ',
]

interface HeaderProps {
  selectedCoin: string
  onSelectCoin: (symbol: string) => void
  loading: boolean
  lastUpdated: number | null
}

export function Header({ selectedCoin, onSelectCoin, loading, lastUpdated }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center gap-4 h-12">
          <div className="flex items-center gap-2 shrink-0">
            <Activity size={16} className="text-accent" />
            <span className="text-sm font-semibold text-bright tracking-tight">
              Whale
            </span>
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 w-max">
              {TOP_SYMBOLS.map((sym) => (
                <button
                  type="button"
                  key={sym}
                  onClick={() => onSelectCoin(sym)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-data font-medium transition-all duration-150',
                    'hover:bg-accent/20 hover:text-accent active:scale-95',
                    selectedCoin === sym
                      ? 'bg-accent/25 text-accent border border-accent/50'
                      : 'text-muted border border-transparent',
                  )}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full',
                  loading ? 'bg-warning animate-pulse' : 'bg-success',
                )}
              />
              <span className="font-data">30s</span>
            </div>
            {lastUpdated && (
              <span className="font-data hidden sm:block">
                {fmtTime(lastUpdated)}
              </span>
            )}
            {loading && <RefreshCw size={12} className="text-muted animate-spin" />}
          </div>
        </div>
      </div>
    </header>
  )
}

export { TOP_SYMBOLS }
