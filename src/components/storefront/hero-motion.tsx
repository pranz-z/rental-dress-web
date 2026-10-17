'use client'

/**
 * The home hero's sliver of client JavaScript. Three small jobs:
 *
 *  · the rotating line of occasions under the headline (crossfade),
 *  · a desktop-only mouse + scroll parallax — a hairline range, transform
 *    only, eased with requestAnimationFrame,
 *  · pausing every hero animation (and the media slot, once footage
 *    arrives) while the tab is hidden or the scene is off screen.
 *
 * Under prefers-reduced-motion it starts nothing at all: the CSS renders
 * its final state and this component simply keeps the first occasion.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const ROTATE_MS = 3000
const CROSSFADE_MS = 520

export function HeroMotion({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(true)

  // the rotating occasion line
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.home-hero')
    if (!root || words.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let swapTimer: number | undefined
    const timer = window.setInterval(() => {
      if (document.hidden || root.hasAttribute('data-hero-paused')) return
      setShown(false)
      swapTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % words.length)
        setShown(true)
      }, CROSSFADE_MS)
    }, ROTATE_MS)

    return () => {
      window.clearInterval(timer)
      if (swapTimer !== undefined) window.clearTimeout(swapTimer)
    }
  }, [words])

  // pause while hidden or scrolled out — plus the parallax rig
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.home-hero')
    if (!root) return

    const video = root.querySelector<HTMLVideoElement>('video')

    let visible = true
    const setPaused = () => {
      const paused = document.hidden || !visible
      root.toggleAttribute('data-hero-paused', paused)
      if (video) {
        if (paused) video.pause()
        else void video.play().catch(() => {})
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      setPaused()
    })
    io.observe(root)
    const onVisibility = () => setPaused()
    document.addEventListener('visibilitychange', onVisibility)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(min-width: 768px) and (pointer: fine)')
    const enabled = () => fine.matches && !motion.matches

    if (motion.matches && video) video.pause()

    const target = { x: 0, y: 0, s: 0 }
    const current = { x: 0, y: 0, s: 0 }
    let running = false

    const apply = () => {
      root.style.setProperty('--hpx', current.x.toFixed(4))
      root.style.setProperty('--hpy', current.y.toFixed(4))
      root.style.setProperty('--hsy', current.s.toFixed(2))
    }

    const step = () => {
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08
      current.s += (target.s - current.s) * 0.1
      apply()
      const settled =
        Math.abs(target.x - current.x) < 0.002 && Math.abs(target.y - current.y) < 0.002 && Math.abs(target.s - current.s) < 0.08
      if (settled) {
        current.x = target.x
        current.y = target.y
        current.s = target.s
        apply()
        running = false
        return
      }
      requestAnimationFrame(step)
    }
    const kick = () => {
      if (running) return
      running = true
      requestAnimationFrame(step)
    }

    const onPointer = (event: PointerEvent) => {
      if (!enabled()) return
      target.x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1))
      target.y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1))
      kick()
    }
    const onScroll = () => {
      if (!enabled()) return
      target.s = Math.max(0, Math.min(window.scrollY, 900))
      kick()
    }
    const onPreference = () => {
      if (!enabled()) {
        target.x = 0
        target.y = 0
        target.s = 0
        kick()
      }
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    motion.addEventListener('change', onPreference)
    fine.addEventListener('change', onPreference)

    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      motion.removeEventListener('change', onPreference)
      fine.removeEventListener('change', onPreference)
      root.removeAttribute('data-hero-paused')
    }
  }, [])

  return (
    <span data-hero-rotate className={cn('hero-rotate inline-block', !shown && 'is-out')}>
      {words[index]}
    </span>
  )
}
