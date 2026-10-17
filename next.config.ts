import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Content Security Policy.
 *
 * The storefront draws every image locally and loads no third-party scripts
 * except Stripe.js (checkout) — so the policy can stay narrow. `unsafe-inline`
 * is required for styles (Tailwind injects them) and for Next's inline
 * bootstrap scripts; `unsafe-eval` appears in development only (react-refresh)
 * along with websocket origins for hot reload. Stripe needs script/frame
 * access to js.stripe.com and API access to api.stripe.com.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://api.stripe.com${isProduction ? '' : ' ws: wss:'}`,
  'frame-src https://js.stripe.com https://hooks.stripe.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'pg', '@electric-sql/pglite', 'bcryptjs'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typedRoutes: false,
  images: {
    // The hero photograph is the one raster image on the storefront; the rest
    // of the catalogue is drawn as local SVG art. Optimisation stays on so
    // next/image can serve correctly sized variants, and quality 80 is
    // allowed alongside the default 75.
    qualities: [75, 80],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
