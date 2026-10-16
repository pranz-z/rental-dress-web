import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Tone } from '@/lib/domain'
import { cn } from '@/lib/cn'
import { Chip } from './chip'

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
  delta,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  icon?: LucideIcon
  delta?: { value: string; positive?: boolean }
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-5 shadow-soft', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        {Icon ? (
          <span
            data-tone={tone}
            className="grid size-8 shrink-0 place-items-center rounded-full border"
            style={{
              background: 'var(--tone-bg)',
              borderColor: 'var(--tone-line)',
              color: 'var(--tone-ink)',
            }}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 font-serif text-[32px] leading-none tracking-tight text-ink">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {delta ? (
          <Chip tone={delta.positive ? 'sage' : 'clay'}>
            {delta.positive ? '▲' : '▼'} {delta.value}
          </Chip>
        ) : null}
        {hint ? <p className="text-[13px] text-ink-muted">{hint}</p> : null}
      </div>
    </div>
  )
}
