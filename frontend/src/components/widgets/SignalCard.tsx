import { AlertTriangle, Info, Zap } from 'lucide-react'
import type { Signal } from '../../types/api'
import { cn } from '../../lib/utils'

interface SignalCardProps {
  signal: Signal
}

const LEVEL_CONFIG = {
  danger: {
    border: 'border-danger/40',
    bg: 'bg-danger/5',
    icon: Zap,
    iconClass: 'text-danger',
    badgeClass: 'bg-danger/20 text-danger',
    label: 'DANGER',
  },
  warning: {
    border: 'border-warning/40',
    bg: 'bg-warning/5',
    icon: AlertTriangle,
    iconClass: 'text-warning',
    badgeClass: 'bg-warning/20 text-warning',
    label: 'WARNING',
  },
  info: {
    border: 'border-accent/40',
    bg: 'bg-accent/5',
    icon: Info,
    iconClass: 'text-accent',
    badgeClass: 'bg-accent/20 text-accent',
    label: 'INFO',
  },
}

export function SignalCard({ signal }: SignalCardProps) {
  const cfg = LEVEL_CONFIG[signal.level] ?? LEVEL_CONFIG.info
  const Icon = cfg.icon

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex flex-col gap-2',
        cfg.border,
        cfg.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon size={16} className={cn('mt-0.5 shrink-0', cfg.iconClass)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded font-data', cfg.badgeClass)}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted font-data uppercase tracking-wide">
              {signal.type}
            </span>
          </div>
          <p className="text-sm font-medium text-bright mt-1 leading-snug">{signal.title}</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{signal.detail}</p>
        </div>
      </div>
      {signal.interpretation && (
        <p className="text-xs text-muted/80 leading-relaxed border-t border-border pt-2 mt-1 italic">
          {signal.interpretation}
        </p>
      )}
    </div>
  )
}
