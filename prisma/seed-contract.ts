/**
 * The demo seeding contract — evaluated as the seed's very first import.
 *
 * `prisma/seed.ts` imports this module before anything else, because importing
 * `@prisma/client` has a side effect: the generated client loads `.env` from
 * the repository root into `process.env`. The guard therefore checks the real
 * process environment here, before any env-loading module can run — a stray
 * .env (or the repository's own .env) can only fail these checks, never
 * satisfy them. `npm run db:seed` is the intended entry point: it loads the
 * repository's .env and .env.local itself, then runs the seed.
 *
 * DEMO_DATA=1 confirms the target is a demo database, both passwords must be
 * present, and each must be at least 12 characters long. Anything missing
 * exits non-zero before the Prisma client exists.
 */

const MIN_PASSWORD_LENGTH = 12

function refuseDemoSeed(lines: string[]): never {
  console.error('')
  for (const line of lines) console.error(`  ${line}`)
  console.error('')
  process.exit(1)
}

function requireDemoPassword(name: 'DEMO_STAFF_PASSWORD' | 'DEMO_CUSTOMER_PASSWORD'): string {
  const value = process.env[name]
  if (!value) {
    return refuseDemoSeed([
      'Demo accounts need passwords that are not committed to the repository.',
      `Set ${name} — the password you will type to sign in — and run the seed again:`,
      '',
      "  npm run db:seed            (loads the repository's .env and .env.local)",
      '',
      'The seed reads only the real process environment; it loads no .env itself.',
    ])
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return refuseDemoSeed([
      `${name} is only ${value.length} characters long.`,
      `Demo passwords must be at least ${MIN_PASSWORD_LENGTH} characters — pick a longer one and retry.`,
    ])
  }
  return value
}

if (process.env.DEMO_DATA !== '1') {
  refuseDemoSeed([
    'This seeder loads DEMO data and wipes the studio rows first.',
    'It refuses to run unless you confirm the database is a demo one:',
    '',
    '  npm run db:seed                  (sets DEMO_DATA=1 for you)',
    '  DEMO_DATA=1 npx tsx prisma/seed.ts',
    '',
    'For a real studio, use the production seed instead: npm run db:seed:prod',
  ])
}

export const staffPassword = requireDemoPassword('DEMO_STAFF_PASSWORD')
export const customerPassword = requireDemoPassword('DEMO_CUSTOMER_PASSWORD')
