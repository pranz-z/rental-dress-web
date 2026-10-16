'use client'

/**
 * The dress gallery: one large view, quiet thumbnails underneath, and a
 * full-screen zoom for the detail shots. Keyboard: arrows move between views,
 * Escape closes the zoom and focus returns to where it started.
 */
import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GarmentImage, viewLabel, type GarmentView } from './garment'

export function DressGallery({
  views,
  name,
  designer,
  color,
  colorHex,
  artTone,
}: {
  views: Array<{ kind: GarmentView; alt: string }>
  name: string
  designer: string
  color: string
  colorHex: string
  artTone: string
}) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const zoomTriggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const current = views[Math.min(active, views.length - 1)]!

  useEffect(() => {
    if (!zoomed) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      zoomTriggerRef.current?.focus()
    }
  }, [zoomed])

  function onThumbKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    setActive((index) => (index + delta + views.length) % views.length)
  }

  return (
    <div>
      <div className="relative">
        <GarmentImage
          name={name}
          designer={designer}
          color={color}
          colorHex={colorHex}
          artTone={artTone}
          view={current.kind}
          alt={current.alt}
          className="aspect-[3/4] w-full"
        />
        <button
          ref={zoomTriggerRef}
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute right-3 bottom-3 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-[13px] font-bold text-ink shadow-soft backdrop-blur-sm transition-colors hover:border-rose hover:text-mulberry"
        >
          <ZoomIn className="size-4" strokeWidth={1.75} aria-hidden />
          Zoom
        </button>
      </div>

      <div
        role="group"
        aria-label={`${name} — views`}
        onKeyDown={onThumbKeys}
        className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {views.map((view, index) => (
          <button
            key={view.kind}
            type="button"
            onClick={() => setActive(index)}
            aria-pressed={index === active}
            aria-label={`Show ${viewLabel(view.kind).toLowerCase()} view`}
            className={cn(
              'shrink-0 rounded-lg border transition-all',
              index === active ? 'border-accent ring-2 ring-accent/20' : 'border-line opacity-80 hover:border-rose hover:opacity-100',
            )}
          >
            <GarmentImage
              name={name}
              designer={designer}
              color={color}
              colorHex={colorHex}
              artTone={artTone}
              view={view.kind}
              alt={view.alt}
              className="aspect-[3/4] w-[76px] rounded-lg border-0"
            />
          </button>
        ))}
      </div>

      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} — enlarged view`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/85 p-4 backdrop-blur-sm sm:p-10"
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoomed(false)
          }}
        >
          <div className="relative w-full max-w-2xl">
            <GarmentImage
              name={name}
              designer={designer}
              color={color}
              colorHex={colorHex}
              artTone={artTone}
              view={current.kind}
              alt={current.alt}
              className="aspect-[3/4] max-h-[82dvh] w-full border-0 shadow-lift"
            />
            <button
              ref={closeRef}
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Close enlarged view"
              className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-soft transition-colors hover:text-mulberry"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
