/**
 * The home hero — an opening scene, not a banner.
 *
 * One self-contained component. Every word and layer lives in HERO and the
 * scene arrays below; the choreography lives in CSS (globals.css, "home
 * hero"), and a sliver of client JavaScript (hero-motion.tsx) adds the
 * rotating occasion line, the desktop mouse/scroll parallax and the
 * pause-when-hidden behaviour.
 *
 * The scene is one photograph (public/images/hero/hero-runway.webp): the
 * figure under the spotlight, pushed slowly toward by the camera, with CSS
 * light shimmer, champagne dust, vignette and grain on top. To move to
 * footage, change `media` in HERO to a video descriptor — the slot already
 * renders a poster-backed, muted, looping, playsInline <video
 * preload="metadata"> and nothing else moves.
 */
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { DateSearch } from '@/components/storefront/date-search'
import { HeroMotion } from '@/components/storefront/hero-motion'
import { cn } from '@/lib/cn'

export type HeroMedia = { kind: 'photo' } | { kind: 'video'; poster: string; sources: Array<{ src: string; type: 'video/webm' | 'video/mp4' }> }

/* The photograph and a 16px blur of it (so the scene never flashes empty).
   Regenerate the blur after changing the file:
   node -e "require('sharp')('public/images/hero/hero-runway.webp').resize(16).webp({quality:24}).toBuffer().then(b=>console.log('data:image/webp;base64,'+b.toString('base64')))" */
const HERO_PHOTO = {
  src: '/images/hero/hero-runway.webp',
  blurDataURL:
    'data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADQAQCdASoQAAwABIB0JbACdACw2z4bJAD+7NDHFXppBI6QPIfADJlsCTC//So/ktcVqcmjb/BE+HLkUMi/0LrnavBo6+BmdOAhD9YZCRUAadKNts8eg4XEgAA=',
}

const HERO = {
  eyebrow: 'Designer dress rental · Boston',
  headline: ['Wear something', 'unforgettable.'],
  occasions: ['Weddings', 'Galas', 'Birthdays', 'Engagements'],
  subline:
    'The Valentina, the Aurelia, the dress you have been picturing — reserved for your date, delivered pressed to your door, and returned with a label we have already paid for.',
  primary: { label: 'Find your dress', href: '#find-your-date' },
  secondary: { label: 'How it works', href: '/how-it-works' },
  searchCaption: 'The calendar knows what is free — searched against every held reservation, prep and cleaning day.',
  scroll: { label: 'Scroll', target: '#dress-for-the-invitation', ariaLabel: 'Scroll to the collection' },
  // The media slot. To ship footage later, swap this object for:
  //   { kind: 'video', poster: '/images/hero/hero-runway.webp', sources: [
  //       { src: '/hero.webm', type: 'video/webm' }, { src: '/hero.mp4', type: 'video/mp4' } ] }
  media: { kind: 'photo' } as HeroMedia,
}

/* Champagne dust and pale petals — brightest inside the spotlight (the
   beam column sits at about 52% of the frame), barely there in the dark
   of the room. The first eight carry the scene on phones. */
type Mote = {
  left: string
  top: string
  size: number
  kind: 'dust' | 'petal'
  alpha: number
  duration: string
  delay: string
  dx: number
  dy: number
  rot: number
  blur: number
}

const MOTES: Mote[] = [
  { left: '41%', top: '24%', size: 5, kind: 'dust', alpha: 0.85, duration: '30s', delay: '-8s', dx: 12, dy: -20, rot: 0, blur: 0 },
  { left: '53%', top: '31%', size: 4, kind: 'dust', alpha: 0.75, duration: '34s', delay: '-18s', dx: -9, dy: -15, rot: 0, blur: 0 },
  { left: '46%', top: '44%', size: 6, kind: 'dust', alpha: 0.9, duration: '27s', delay: '-3s', dx: 15, dy: -22, rot: 0, blur: 0.3 },
  { left: '57%', top: '52%', size: 4, kind: 'dust', alpha: 0.6, duration: '31s', delay: '-12s', dx: -8, dy: -18, rot: 0, blur: 0 },
  { left: '38%', top: '63%', size: 5, kind: 'dust', alpha: 0.7, duration: '36s', delay: '-24s', dx: 10, dy: -16, rot: 0, blur: 0.3 },
  { left: '50%', top: '72%', size: 4, kind: 'dust', alpha: 0.65, duration: '29s', delay: '-10s', dx: -12, dy: -20, rot: 0, blur: 0 },
  { left: '44%', top: '15%', size: 3, kind: 'dust', alpha: 0.55, duration: '33s', delay: '-6s', dx: 9, dy: -14, rot: 0, blur: 0 },
  { left: '55%', top: '20%', size: 6, kind: 'petal', alpha: 0.5, duration: '26s', delay: '-14s', dx: -10, dy: 18, rot: -24, blur: 0.5 },
  { left: '10%', top: '30%', size: 4, kind: 'dust', alpha: 0.25, duration: '35s', delay: '-20s', dx: 11, dy: -14, rot: 0, blur: 0 },
  { left: '18%', top: '58%', size: 3, kind: 'dust', alpha: 0.2, duration: '32s', delay: '-9s', dx: -9, dy: -16, rot: 0, blur: 0 },
  { left: '8%', top: '72%', size: 5, kind: 'dust', alpha: 0.3, duration: '28s', delay: '-22s', dx: 12, dy: -12, rot: 0, blur: 0.3 },
  { left: '24%', top: '18%', size: 6, kind: 'petal', alpha: 0.3, duration: '30s', delay: '-5s', dx: -11, dy: 17, rot: 22, blur: 0.4 },
  { left: '15%', top: '44%', size: 3, kind: 'dust', alpha: 0.22, duration: '37s', delay: '-26s', dx: 8, dy: -15, rot: 0, blur: 0 },
  { left: '68%', top: '26%', size: 6, kind: 'petal', alpha: 0.28, duration: '29s', delay: '-16s', dx: 10, dy: 16, rot: -20, blur: 0.4 },
  { left: '77%', top: '60%', size: 4, kind: 'dust', alpha: 0.3, duration: '33s', delay: '-7s', dx: -10, dy: -14, rot: 0, blur: 0 },
  { left: '85%', top: '40%', size: 3, kind: 'dust', alpha: 0.22, duration: '31s', delay: '-19s', dx: 9, dy: -13, rot: 0, blur: 0 },
  { left: '91%', top: '68%', size: 6, kind: 'petal', alpha: 0.26, duration: '27s', delay: '-11s', dx: -12, dy: 15, rot: 26, blur: 0.5 },
  { left: '65%', top: '78%', size: 4, kind: 'dust', alpha: 0.24, duration: '34s', delay: '-23s', dx: 8, dy: -12, rot: 0, blur: 0 },
  { left: '30%', top: '80%', size: 4, kind: 'dust', alpha: 0.28, duration: '36s', delay: '-4s', dx: -9, dy: -18, rot: 0, blur: 0 },
  { left: '71%', top: '12%', size: 3, kind: 'dust', alpha: 0.2, duration: '30s', delay: '-27s', dx: 10, dy: -11, rot: 0, blur: 0 },
]

export function HomeHero({ occasions, sizes }: { occasions: string[]; sizes: string[] }) {
  return (
    <div className="home-hero relative">
      <section
        aria-labelledby="hero-heading"
        className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[var(--hero-night)] pt-[env(safe-area-inset-top)]"
      >
        {/* ── the scene (decorative: photo, light, dust, grain) ──────── */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* the photograph, pushed slowly toward the figure */}
          <div className="hero-layer absolute -inset-[6%]" style={{ '--mx': '7px', '--my': '5px', '--sy': '0.02' } as CSSProperties}>
            <div className="hero-kb absolute inset-0" style={{ transformOrigin: '52% 30%' }}>
              {HERO.media.kind === 'photo' ? (
                <Image
                  src={HERO_PHOTO.src}
                  alt=""
                  aria-hidden
                  fill
                  preload
                  sizes="100vw"
                  quality={80}
                  placeholder="blur"
                  blurDataURL={HERO_PHOTO.blurDataURL}
                  className="object-cover object-[52%_50%] lg:landscape:object-[50%_10%]"
                />
              ) : (
                <video
                  className="absolute inset-0 h-full w-full object-cover object-[52%_50%] lg:landscape:object-[50%_10%]"
                  poster={HERO.media.poster}
                  preload="metadata"
                  playsInline
                  muted
                  loop
                  autoPlay
                >
                  {HERO.media.sources.map((source) => (
                    <source key={source.src} src={source.src} type={source.type} />
                  ))}
                </video>
              )}

              {/* a warm shimmer of light, breathing with the spotlight */}
              <div
                className="hero-shimmer absolute inset-0"
                style={{
                  background:
                    'radial-gradient(36% 56% at 52% 26%, rgba(255,216,160,0.14) 0%, rgba(255,200,132,0.05) 46%, rgba(255,200,132,0) 74%)',
                  mixBlendMode: 'screen',
                }}
              />
            </div>
          </div>

          {/* champagne dust and petals, drifting at their own slow pace */}
          <div className="hero-layer absolute inset-0" style={{ '--mx': '16px', '--my': '11px', '--sy': '0.05' } as CSSProperties}>
            {MOTES.map((mote, index) => (
              <span
                key={index}
                className={cn('hero-mote absolute block', index >= 8 && 'hidden md:block')}
                style={
                  {
                    left: mote.left,
                    top: mote.top,
                    width: mote.size,
                    height: mote.kind === 'petal' ? Math.round(mote.size * 1.5) : mote.size,
                    borderRadius: mote.kind === 'petal' ? '58% 42% 52% 48% / 48% 58% 42% 52%' : '999px',
                    background:
                      mote.kind === 'petal'
                        ? `linear-gradient(140deg, rgba(243,225,225,${mote.alpha}), rgba(216,167,167,${Math.round(mote.alpha * 70) / 100}))`
                        : `radial-gradient(circle at 35% 35%, rgba(255,226,178,${mote.alpha}), rgba(255,226,178,0) 72%)`,
                    filter: mote.blur ? `blur(${mote.blur}px)` : undefined,
                    '--mote-x': `${mote.dx}px`,
                    '--mote-y': `${mote.dy}px`,
                    '--mote-rot': `${mote.rot}deg`,
                    '--mote-t': mote.duration,
                    '--mote-delay': mote.delay,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* the room's own vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(118% 92% at 50% 18%, rgba(15,11,10,0) 38%, rgba(15,11,10,0.3) 72%, rgba(10,7,7,0.58) 100%)',
            }}
          />

          {/* film grain — holds the mood and hides the resolution */}
          <div className="hero-grain absolute -inset-[5%]" />

          {/* scrims: the bottom on phones, the left side once the words sit there */}
          <div
            className="absolute inset-0 lg:landscape:hidden"
            style={{
              background:
                'linear-gradient(to top, rgba(15,11,10,0.96) 0%, rgba(15,11,10,0.92) 14%, rgba(15,11,10,0.83) 28%, rgba(15,11,10,0.72) 42%, rgba(15,11,10,0.6) 56%, rgba(15,11,10,0.4) 70%, rgba(15,11,10,0.18) 84%, rgba(15,11,10,0) 100%)',
            }}
          />
          <div
            className="absolute inset-0 hidden lg:landscape:block"
            style={{
              background:
                'linear-gradient(to top, rgba(15,11,10,0.72) 0%, rgba(15,11,10,0.28) 10%, rgba(15,11,10,0) 22%), linear-gradient(90deg, rgba(15,11,10,0.86) 0%, rgba(15,11,10,0.5) 30%, rgba(15,11,10,0.14) 58%, rgba(15,11,10,0) 78%), radial-gradient(28% 42% at 24% 50%, rgba(15,11,10,0.78) 0%, rgba(15,11,10,0.4) 55%, rgba(15,11,10,0) 100%)',
            }}
          />

          {/* the film opens from black */}
          <div className="hero-veil absolute inset-0 bg-[var(--hero-night)]" />
        </div>

        {/* ── the words ─────────────────────────────────────────────── */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-end px-4 pt-10 pb-2 sm:px-6 lg:landscape:items-center lg:landscape:pb-0 lg:px-8 2xl:max-w-[1600px]">
          <div className="relative w-full lg:landscape:w-[34%] lg:landscape:max-w-[27rem] lg:landscape:[container-type:inline-size]">
            <div className="relative">
              <p className="hero-reveal hero-d-eye hero-copy-shadow text-[11px] font-bold tracking-[0.26em] text-ivory/90 uppercase">{HERO.eyebrow}</p>
              <h1
                id="hero-heading"
                className="hero-copy-shadow-lg mt-4 font-serif text-ivory text-[clamp(2.6rem,5.6vw,4.1rem)] leading-[1.04] tracking-[-0.015em] lg:landscape:text-[min(15.8cqw,4.1rem)]"
              >
                {HERO.headline.map((line, index) => (
                  <span key={line} className={cn('hero-reveal block', index === 0 ? 'hero-d-1' : 'hero-d-2')}>
                    {line}
                    {index < HERO.headline.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </h1>
              <p aria-hidden className="hero-reveal hero-d-rot hero-copy-shadow mt-3.5 font-serif text-lg italic text-[#ecd9ae] sm:text-xl">
                <HeroMotion words={HERO.occasions} />
              </p>
              <div className="hero-rule mt-5 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent sm:w-56" />
              <p className="hero-reveal hero-d-sub hero-copy-shadow mt-5 text-[15px] leading-relaxed text-ivory/85 sm:text-[17px]">{HERO.subline}</p>
              <div className="hero-reveal hero-d-cta mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <a
                  href={HERO.primary.href}
                  className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-ivory px-8 text-[15px] font-bold tracking-wide text-mulberry shadow-lift transition-colors hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto"
                >
                  {HERO.primary.label}
                  <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden />
                </a>
                <a
                  href={HERO.secondary.href}
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border-2 border-ivory/75 px-8 text-[15px] font-bold tracking-wide text-ivory transition-colors hover:border-ivory hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto"
                >
                  {HERO.secondary.label}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── the scroll cue ────────────────────────────────────────── */}
        <div className="relative z-10 flex justify-center pb-10 md:pb-[6.75rem]">
          <a
            href={HERO.scroll.target}
            aria-label={HERO.scroll.ariaLabel}
            className="hero-reveal hero-d-cta group grid justify-items-center gap-2.5 rounded-full p-2"
          >
            <span className="hero-copy-shadow text-[10px] font-bold tracking-[0.34em] text-ivory/90 uppercase transition-colors group-hover:text-gold">
              {HERO.scroll.label}
            </span>
            <span aria-hidden className="relative block h-12 w-px overflow-hidden bg-ivory/25">
              <span className="hero-cue-dot absolute inset-x-0 top-0 block h-5 bg-gold" />
            </span>
          </a>
        </div>
      </section>

      {/* ── the date-first search, straddling the hero's bottom edge ── */}
      <div id="find-your-date" className="relative z-20 mx-auto -mt-8 w-full max-w-4xl scroll-mt-24 px-4 sm:px-6 md:-mt-[5.25rem] lg:px-8">
        <div className="hero-reveal--card">
          <DateSearch occasions={occasions} sizes={sizes} />
        </div>
        <p className="hero-reveal--card mt-2.5 text-center text-xs leading-relaxed text-ink-muted">{HERO.searchCaption}</p>
      </div>
    </div>
  )
}
