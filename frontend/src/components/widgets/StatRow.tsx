import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface StatRowProps {
  label: string
  value: string | ReactNode
  valueClass?: string
  className?: string
}

export function StatRow({ label, value, valueClass, className }: StatRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-1', className)}>
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className={cn('text-xs font-data text-bright truncate text-right', valueClass)}>
        {value}
      </span>
    </div>
  )
}
