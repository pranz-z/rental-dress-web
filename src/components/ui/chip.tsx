import type { ReactNode } from 'react'
import type { Tone } from '@/lib/domain'
import { cn } from '@/lib/cn'

/**
 * Small status pill. Colour comes from the shared tone system (data-tone),
 * so a "Late" booking reads the same clay everywhere it appears.
 */
export function Chip({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span data-tone={tone} className={cn('chip', className)}>
      {dot ? <span className="chip-dot" aria-hidden /> : null}
      {children}
    </span>
  )
}

/** Square-ish variant used in tables where a pill would feel too loud. */
export function ToneMark({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  return <span data-tone={tone} className={cn('inline-block size-2 rounded-full', className)} aria-hidden />
}
