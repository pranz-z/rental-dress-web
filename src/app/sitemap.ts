import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dresses = await prisma.dress.findMany({
    where: { status: { not: 'RETIRED' } },
    select: { slug: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/size-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/membership`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/policies/rental-terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/policies/returns`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/policies/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const dressPages: MetadataRoute.Sitemap = dresses.map((dress) => ({
    url: `${BASE_URL}/dress/${dress.slug}`,
    lastModified: dress.createdAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticPages, ...dressPages]
}
