/**
 * Garment art, storefront edition.
 *
 * The single image component the whole storefront draws through — home,
 * shop, dress pages, cart, account. Each dress is rendered in its own colour
 * on an editorial backdrop keyed by the dress's art tone, in five gallery
 * views. When photography arrives, swap this component's internals once and
 * every surface follows.
 */
import type { ImageKind } from '@prisma/client'
import { cn } from '@/lib/cn'

export type GarmentView = 'FRONT' | 'BACK' | 'DETAIL' | 'ON_BODY' | 'MOVEMENT'

type Backdrop = { from: string; to: string; frame: string }

const BACKDROPS: Record<string, Backdrop> = {
  blush: { from: '#f3e1e1', to: '#fdf7f4', frame: '#eed7d7' },
  rose: { from: '#ecd3d3', to: '#fbf2f1', frame: '#e5c8c8' },
  ivory: { from: '#f4ede7', to: '#fefcfb', frame: '#eadfd8' },
  champagne: { from: '#f2e6cf', to: '#fcf9f2', frame: '#e8dabb' },
  gold: { from: '#efe0bd', to: '#fbf6e9', frame: '#e5d3a8' },
  organza: { from: '#f6ece7', to: '#fdfaf8', frame: '#ecdcd4' },
  satin: { from: '#f4e6ea', to: '#fdf8f9', frame: '#ecd6dc' },
  pearl: { from: '#efece7', to: '#fdfcfa', frame: '#e2ddd4' },
  terracotta: { from: '#f0d9cb', to: '#fbf1ea', frame: '#e6c6b3' },
  emerald: { from: '#2f4a41', to: '#5c7a6d', frame: '#243b34' },
  midnight: { from: '#2c3340', to: '#556074', frame: '#232935' },
  noir: { from: '#2b2628', to: '#514a4e', frame: '#211d1f' },
  burgundy: { from: '#4a232c', to: '#7c4652', frame: '#381a21' },
}

export function backdropFor(artTone: string): Backdrop {
  return BACKDROPS[artTone] ?? BACKDROPS.blush!
}

export function garmentAlt(input: { name: string; designer?: string; color: string; view: GarmentView; backdrop?: string }): string {
  const by = input.designer ? ` by ${input.designer}` : ''
  switch (input.view) {
    case 'BACK':
      return `The back of the ${input.name}${by}, in ${input.color.toLowerCase()}`
    case 'DETAIL':
      return `Close detail of the ${input.name}${by} in ${input.color.toLowerCase()}`
    case 'ON_BODY':
      return `The ${input.name}${by} on a dress form in the Newbury Street studio`
    case 'MOVEMENT':
      return `The ${input.name}${by} shown in movement, the hem turning with the wearer`
    case 'FRONT':
    default:
      return `The ${input.name}${by} photographed from the front, ${input.color.toLowerCase()}`
  }
}

export function GarmentImage({
  name,
  designer,
  color,
  colorHex,
  artTone,
  view = 'FRONT',
  alt,
  className,
  artClassName,
}: {
  name: string
  designer?: string
  color: string
  colorHex: string
  artTone: string
  view?: GarmentView
  alt?: string
  className?: string
  artClassName?: string
}) {
  const backdrop = backdropFor(artTone)
  const label = alt ?? garmentAlt({ name, designer, color, view })

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative overflow-hidden rounded-xl border border-line', className)}
      style={{ background: `linear-gradient(160deg, ${backdrop.from} 0%, ${backdrop.to} 78%)` }}
    >
      {/* soft studio light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 55% at 50% 8%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)' }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[14%]" style={{ background: `linear-gradient(to top, ${backdrop.frame}66, transparent)` }} />
      <svg
        viewBox="0 0 120 160"
        aria-hidden
        className={cn('absolute inset-0 h-full w-full', artClassName)}
        preserveAspectRatio="xMidYMid meet"
        fill="none"
      >
        <ellipse cx="60" cy="150" rx="34" ry="5" fill="rgba(59,53,54,0.10)" />
        {view === 'FRONT' ? <FrontView colorHex={colorHex} /> : null}
        {view === 'BACK' ? <BackView colorHex={colorHex} /> : null}
        {view === 'DETAIL' ? <DetailView colorHex={colorHex} /> : null}
        {view === 'ON_BODY' ? <OnBodyView colorHex={colorHex} /> : null}
        {view === 'MOVEMENT' ? <MovementView colorHex={colorHex} /> : null}
      </svg>
    </div>
  )
}

const STROKE = 'rgba(42, 35, 38, 0.16)'

function FrontView({ colorHex }: { colorHex: string }) {
  return (
    <g transform="translate(0 -4)">
      <path
        d="M40 28 L60 44 L80 28 L75 58 L73 70 C80 98 90 128 102 152 Q60 162 18 152 C30 128 40 98 47 70 L45 58 Z"
        fill={colorHex}
        stroke={STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M47 70 Q60 77 73 70" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M58 80 C56 102 50 128 42 148" stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function BackView({ colorHex }: { colorHex: string }) {
  return (
    <g transform="translate(0 -4)">
      <path
        d="M42 30 L78 30 L76 60 L74 70 C81 98 91 128 102 152 Q60 162 18 152 C30 128 40 98 46 70 L44 60 Z"
        fill={colorHex}
        stroke={STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M60 34 V148" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeDasharray="3 4" strokeLinecap="round" />
      <path d="M46 58 H74" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M52 62 Q60 68 68 62" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function DetailView({ colorHex }: { colorHex: string }) {
  return (
    <g>
      <path
        d="M16 52 Q60 22 104 52 L101 128 Q60 150 19 128 Z"
        fill={colorHex}
        stroke={STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M30 58 C44 50 54 66 70 62 C84 58 92 64 98 60" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 82 C42 74 52 92 68 86 C82 81 92 88 98 82" stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 108 C40 100 52 116 68 110 C82 105 92 112 100 106" stroke="rgba(255,255,255,0.2)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 126 H102" stroke="rgba(59,53,54,0.22)" strokeWidth="1" strokeDasharray="2 3" />
      {[
        [42, 68],
        [60, 76],
        [78, 70],
        [50, 96],
        [70, 98],
        [60, 118],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="rgba(255,255,255,0.75)" />
      ))}
    </g>
  )
}

function OnBodyView({ colorHex }: { colorHex: string }) {
  return (
    <g>
      {/* dress form */}
      <circle cx="60" cy="24" r="7.5" fill="#e9d6c9" stroke="rgba(42,35,38,0.14)" strokeWidth="1" />
      <path d="M60 32 V44" stroke="rgba(42,35,38,0.2)" strokeWidth="2.5" />
      <path d="M38 128 H82 M50 128 L60 148 L70 128" stroke="rgba(42,35,38,0.2)" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M44 46 Q60 56 76 46 L73 66 C80 94 90 118 96 132 Q60 142 24 132 C30 118 40 94 47 66 Z"
        fill={colorHex}
        stroke={STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M46 20 Q60 44 74 20" fill={colorHex} stroke={STROKE} strokeWidth="1" strokeLinejoin="round" />
      <path d="M47 66 Q60 72 73 66" stroke="rgba(255,255,255,0.42)" strokeWidth="2" strokeLinecap="round" />
      <path d="M56 78 C54 98 50 116 46 130" stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function MovementView({ colorHex }: { colorHex: string }) {
  return (
    <g transform="translate(0 -4)">
      <path
        d="M40 28 L60 44 L80 28 L75 58 L73 70 C80 96 90 122 100 142 Q90 152 78 144 Q68 136 62 144 Q54 152 44 144 Q36 136 30 142 C34 118 42 94 47 70 L45 58 Z"
        fill={colorHex}
        stroke={STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M48 70 Q60 76 72 70" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M92 88 Q102 92 108 86" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M90 102 Q104 108 112 100" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M40 96 Q28 102 22 96" stroke="rgba(59,53,54,0.14)" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

export const GALLERY_VIEWS: GarmentView[] = ['FRONT', 'BACK', 'DETAIL', 'ON_BODY', 'MOVEMENT']

export function viewLabel(kind: GarmentView): string {
  const labels: Record<GarmentView, string> = {
    FRONT: 'Front',
    BACK: 'Back',
    DETAIL: 'Detail',
    ON_BODY: 'On body',
    MOVEMENT: 'In movement',
  }
  return labels[kind]
}

export function isGarmentView(value: string): value is GarmentView {
  return (GALLERY_VIEWS as string[]).includes(value)
}

export type { ImageKind }
