/**
 * Rate limiting for public forms.
 *
 * A sliding fixed-window counter held in memory — right for the single-node
 * deployment this site runs on, and deliberately easy to swap for Redis when
 * the studio grows. Keys combine the action with the caller's address, so one
 * busy visitor cannot lock out the rest of the city.
 */
import { headers } from 'next/headers'

type Entry = { count: number; resetAt: number }

const globalForLimiter = globalThis as unknown as { mrRateBuckets?: Map<string, Entry> }
const buckets = globalForLimiter.mrRateBuckets ?? new Map<string, Entry>()
globalForLimiter.mrRateBuckets = buckets

let lastSweep = 0

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()

  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(bucketKey)
    }
  }

  const entry = buckets.get(key)
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: 0 }
  }

  entry.count += 1
  if (entry.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(Math.ceil((entry.resetAt - now) / 1000), 1) }
  }
  return { ok: true, retryAfterSeconds: 0 }
}

/** The caller's address as Next sees it behind the tunnel or proxy. */
export async function callerAddress(): Promise<string> {
  try {
    const store = await headers()
    const forwarded = store.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]!.trim()
    return store.get('x-real-ip') || 'local'
  } catch {
    return 'local'
  }
}

export function waitMessage(retryAfterSeconds: number): string {
  const wait = retryAfterSeconds > 90 ? 'a few minutes' : retryAfterSeconds > 45 ? 'a minute' : `${retryAfterSeconds} seconds`
  return `That came through a little fast — give it ${wait} and try again.`
}
