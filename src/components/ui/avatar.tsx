import type { Tone } from '@/lib/domain'
import { cn } from '@/lib/cn'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** Stable tone per person, so the same customer keeps the same colour. */
function toneOf(name: string): Tone {
  const tones: Tone[] = ['rose', 'gold', 'mulberry', 'clay', 'sage', 'blush']
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return tones[hash % tones.length]
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims = { sm: 'size-8 text-[11px]', md: 'size-9 text-xs', lg: 'size-11 text-sm' }[size]
  return (
    <span
      data-tone={toneOf(name)}
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border font-sans font-bold tracking-wide',
        dims,
        className,
      )}
      style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
    >
      {initialsOf(name)}
    </span>
  )
}
