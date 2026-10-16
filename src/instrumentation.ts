import type { Instrumentation } from 'next'

/**
 * Server instrumentation.
 *
 * `onRequestError` is Next's hook for every uncaught server error — a page, a
 * route handler, a server action. We log it, and when `ERROR_WEBHOOK_URL` is
 * set we forward a compact report to whatever monitor the studio uses (Slack
 * incoming webhook, Better Stack, …). Reporting must never throw: a monitoring
 * failure cannot take a request down with it.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : undefined

  console.error(
    `[request error] ${request.method} ${request.path} (${context.routeType}, ${context.routePath}) — ${message}${digest ? ` [${digest}]` : ''}`,
  )

  const url = process.env.ERROR_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Maison Rêve error — ${request.method} ${request.path}: ${message}`,
        method: request.method,
        path: request.path,
        routePath: context.routePath,
        routeType: context.routeType,
        digest,
        message,
        stack: stack?.slice(0, 4000),
        at: new Date().toISOString(),
      }),
    })
  } catch (reportError) {
    console.error('Error webhook forward failed:', reportError)
  }
}

/**
 * Startup check for the environment a live deployment must have. The site
 * still boots — /api/health reports what is missing — but the server log
 * makes the gap unmissable.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const required = ['DATABASE_URL', 'AUTH_SECRET', 'NEXT_PUBLIC_APP_URL']
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(', ')} — see README launch checklist.`)
  }
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_MODE) {
    console.info('[startup] STRIPE_MODE is not set; Stripe runs in test mode by default.')
  }
}
