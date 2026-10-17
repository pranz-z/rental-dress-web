/**
 * Test bootstrap.
 *
 * Loads .env the way the standalone scripts do — an explicit DATABASE_URL in
 * the shell always wins, so the same suite can run against the embedded dev
 * database, a local PostgreSQL, or the CI service container without edits.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

for (const file of ['.env', '.env.local']) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) continue
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue // real process env wins
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

// Modules that sign sessions read this at call time; tests never sign in.
process.env.AUTH_SECRET ||= 'vitest-only-secret'

// Remember whether a real database was configured, then give the Prisma
// module a placeholder so pure unit suites can still be imported without one.
// Database-backed tests check ZZ_TEST_DATABASE and skip themselves.
if (process.env.DATABASE_URL) {
  process.env.ZZ_TEST_DATABASE = '1'
} else {
  process.env.DATABASE_URL = 'postgresql://zztest:zztest@127.0.0.1:1/zztest-never-connected'
}
