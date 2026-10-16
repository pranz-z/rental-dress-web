import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Tone } from '@/lib/domain'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon ? (
        <span
          data-tone={tone}
          className="mb-4 grid size-11 place-items-center rounded-full border"
          style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <h3 className="font-serif text-xl text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
