/**
 * Maison Rêve — production seed.
 *
 * What a real launch starts from, and nothing else: the Owner's account plus
 * the studio's configuration rows (rental rules, hours, delivery zones, email
 * templates). No demo wardrobe, no customers, no seeded passwords that live on
 * anywhere. The Owner chooses their own password and enrolls an authenticator
 * app on first sign-in — this seed only issues a temporary password, prints it
 * once, and marks the account as needing both steps.
 *
 * Refuses to run if any staff account already exists, so it can never trample
 * a live studio.
 *
 * Run: npm run db:seed:prod
 *
 * Environment:
 *   OWNER_NAME              display name (default "Studio Owner")
 *   OWNER_EMAIL             sign-in address (required)
 *   OWNER_INITIAL_PASSWORD  one-time password; generated and printed when omitted
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient, type StaffRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { NOTIFICATION_TEMPLATES, STUDIO_SETTINGS } from './seed-content'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* .env.local is optional */
}
try {
  process.loadEnvFile('.env')
} catch {
  /* .env is optional */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

async function main() {
  const existingStaff = await prisma.staffUser.count()
  if (existingStaff > 0) {
    console.error(
      `\n  Refusing to seed: ${existingStaff} staff account${existingStaff === 1 ? '' : 's'} already exist.\n` +
        '  The production seed only ever runs against an empty studio.\n',
    )
    process.exitCode = 1
    return
  }

  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('\n  OWNER_EMAIL is required — set it to the Owner’s sign-in address.\n')
    process.exitCode = 1
    return
  }

  const name = (process.env.OWNER_NAME ?? 'Studio Owner').trim() || 'Studio Owner'
  const generated = !process.env.OWNER_INITIAL_PASSWORD
  const temporaryPassword = process.env.OWNER_INITIAL_PASSWORD || randomBytes(9).toString('base64url')

  console.log('  Seeding a production studio — Owner account and configuration only…')

  // Configuration first: the app reads these rows on every page.
  await prisma.studioSettings.upsert({
    where: { id: 'studio' },
    update: {},
    create: STUDIO_SETTINGS,
  })
  for (const template of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: template,
    })
  }

  await prisma.staffUser.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      role: 'OWNER' as StaffRole,
      title: 'Founder & owner',
      accentTone: 'gold',
      // First sign-in is staged: set a password, then enroll an authenticator.
      mustChangePassword: true,
      twoFactorRequired: true,
      twoFactorEnabled: false,
    },
  })

  console.log('\n  ✔ Studio configuration seeded (rental rules, hours, zones, templates).')
  console.log(`  ✔ Owner account created: ${email}`)
  if (generated) {
    console.log(`\n     Temporary password (shown once): ${temporaryPassword}\n`)
  } else {
    console.log('\n     Temporary password: the OWNER_INITIAL_PASSWORD value from the environment.\n')
  }
  console.log('  Next: sign in at /studio/login. The studio will ask for a new password,')
  console.log('  then walk the Owner through enrolling an authenticator app. Both are required.\n')
}

main()
  .catch((error) => {
    console.error('Production seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
