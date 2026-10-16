import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The studio is never advertised, and customer-only surfaces stay out
        // of every index.
        disallow: ['/studio', '/account', '/cart', '/checkout', '/api'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
