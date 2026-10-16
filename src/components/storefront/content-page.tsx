import type { ReactNode } from 'react'

/** Shared mastheads and FAQ accordions for the storefront's editorial pages. */
export function ContentHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <header className="max-w-2xl">
      <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">{eyebrow}</p>
      <h1 className="mt-2.5 font-serif text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{lede}</p>
    </header>
  )
}

export function Faq({ items }: { items: Array<{ q: string; a: ReactNode }> }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-ink [&::-webkit-details-marker]:hidden sm:px-6">
            {item.q}
            <span aria-hidden className="text-lg text-gold-ink transition-transform group-open:rotate-45">
              ＋
            </span>
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-ink-muted sm:px-6">{item.a}</div>
        </details>
      ))}
    </div>
  )
}
