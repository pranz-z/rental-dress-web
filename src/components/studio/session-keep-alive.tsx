'use client'

import { useEffect, useRef } from 'react'

const PING_INTERVAL_MS = 5 * 60_000

/**
 * Keeps the studio session alive while a tab is open. Pings every five
 * minutes and again whenever the tab becomes visible; a 401 means the
 * 30-minute inactivity window ran out, so we return to sign-in.
 */
export function SessionKeepAlive() {
  const lastPingRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function ping() {
      lastPingRef.current = Date.now()
      try {
        const response = await fetch('/api/auth/touch', { method: 'POST' })
        if (cancelled) return
        if (response.status === 401) {
          window.location.assign('/studio/login?reason=timeout')
        }
      } catch {
        /* offline — the next navigation will decide */
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ping()
    }, PING_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPingRef.current > 60_000) {
        void ping()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
