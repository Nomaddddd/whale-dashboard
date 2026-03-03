import { useState } from 'react'
import { AlertCircle, ArrowDownUp, BarChart3, Loader2 } from 'lucide-react'
import { useWhaleData } from './hooks/useWhaleData'
import { Header, TOP_SYMBOLS } from './components/widgets/Header'
import { CoinCard } from './components/widgets/CoinCard'
import { SignalCard } from './components/widgets/SignalCard'
import { FundingComparison } from './components/widgets/FundingComparison'
import { LiquidationSummary } from './components/widgets/LiquidationSummary'
import { BinancePanel } from './components/charts/BinancePanel'
import { OkxPanel } from './components/charts/OkxPanel'
import { HyperliquidPanel } from './components/charts/HyperliquidPanel'
import { AsterPanel } from './components/charts/AsterPanel'
import { fmtTime, fmtUsd } from './lib/format'
import type { TransferEntry } from './types/api'
import { cn } from './lib/utils'

function TransferTable({ transfers }: { transfers: TransferEntry[] }) {
  if (transfers.length === 0) return null
  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
        <ArrowDownUp size={12} className="text-accent" />
        Large Transfers ({transfers.length})
      </h3>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs font-data">
          <thead className="border-b border-border">
            <tr className="text-muted">
              <th className="text-left px-4 py-2">Exchange</th>
              <th className="text-right px-4 py-2">Amount (USD)</th>
              <th className="text-right px-4 py-2">Type</th>
              <th className="text-right px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transfers.slice(0, 15).map((t) => (
              <tr key={`${t.transaction_time}-${t.amount_usd}`}>
                <td className="px-4 py-2 text-muted">{t.exchange_name ?? '--'}</td>
                <td className="px-4 py-2 text-right text-bright">${fmtUsd(t.amount_usd)}</td>
                <td className="px-4 py-2 text-right">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs',
                    t.transfer_type === 1 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
                  )}>
                    {t.transfer_type === 1 ? 'IN' : 'OUT'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-muted">{fmtTime(t.transaction_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function App() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const { data, loading, error, lastUpdated } = useWhaleData(selectedCoin)
  const { dashboardData, analysisData } = data

  return (
    <div className="min-h-[100dvh] bg-bg text-bright">
      <Header
        selectedCoin={selectedCoin}
        onSelectCoin={setSelectedCoin}
        loading={loading}
        lastUpdated={lastUpdated}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-6 flex flex-col gap-8">
        {error && (
          <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !dashboardData && (
          <div className="flex items-center justify-center gap-3 py-24 text-muted">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-sm">Loading whale data…</span>
          </div>
        )}

        {dashboardData && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-accent" />
              <h2 className="text-xs font-medium text-muted uppercase tracking-widest">
                Market Overview
              </h2>
              {lastUpdated && (
                <span className="text-xs text-muted font-data ml-auto">
                  Updated {fmtTime(lastUpdated)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
              {TOP_SYMBOLS.map((sym) => {
                const coin = dashboardData.coins[sym]
                if (!coin) return null
                return (
                  <CoinCard
                    key={sym}
                    symbol={sym}
                    coin={coin}
                    selected={selectedCoin === sym}
                    onClick={() => setSelectedCoin(sym)}
                  />
                )
              })}
            </div>
          </section>
        )}

        {analysisData && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <h2 className="text-sm font-semibold text-bright">
                {selectedCoin} Analysis
              </h2>
              <span className="text-xs text-muted font-data">
                {analysisData.signals.length} signals
              </span>
            </div>

            {analysisData.signals.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-3">
                  Signal Alerts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {analysisData.signals.map((signal) => (
                    <SignalCard key={`${signal.type}-${signal.title}`} signal={signal} />
                  ))}
                </div>
              </div>
            )}

            <FundingComparison comparison={analysisData.fundingComparison} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {analysisData.exchanges.binance && (
                <BinancePanel data={analysisData.exchanges.binance} />
              )}
              {analysisData.exchanges.okx && (
                <OkxPanel data={analysisData.exchanges.okx} />
              )}
              {analysisData.exchanges.hyperliquid && (
                <HyperliquidPanel data={analysisData.exchanges.hyperliquid} />
              )}
              {analysisData.exchanges.aster && (
                <AsterPanel data={analysisData.exchanges.aster} />
              )}
            </div>

            {analysisData.aggregated.liquidation && (
              <LiquidationSummary liq={analysisData.aggregated.liquidation} />
            )}

            {analysisData.aggregated.transfers && analysisData.aggregated.transfers.length > 0 && (
              <TransferTable transfers={analysisData.aggregated.transfers} />
            )}
          </section>
        )}
      </main>
    </div>
  )
}
