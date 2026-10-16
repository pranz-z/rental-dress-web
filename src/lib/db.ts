import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma client.
 *
 * Production points DATABASE_URL at managed PostgreSQL. Local review uses the
 * bundled embedded PostgreSQL (npm run db:start), which serialises connections,
 * so PG_POOL_MAX is set to 1 in .env for that setup.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local, then run `npm run db:setup` to create the studio database.',
    )
  }
  const max = Number(process.env.PG_POOL_MAX ?? 10)
  const adapter = new PrismaPg({ connectionString, max })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type { PrismaClient }
