'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A horizontal editorial rail with quiet arrow controls. */
export function Rail({ ariaLabel, children, className }: { ariaLabel: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  function scrollBy(direction: 1 | -1) {
    const node = ref.current
    if (!node) return
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div className="pointer-events-none absolute top-1/2 -right-2 hidden -translate-y-1/2 gap-1.5 sm:flex">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll backward"
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-line bg-surface/95 text-ink-muted shadow-soft transition-colors hover:border-rose hover:text-mulberry"
        >
          <ChevronLeft className="size-4.5" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll forward"
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-line bg-surface/95 text-ink-muted shadow-soft transition-colors hover:border-rose hover:text-mulberry"
        >
          <ChevronRight className="size-4.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  )
}
