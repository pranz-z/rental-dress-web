/**
 * `npm run db:seed` — the demo seeder with the DEMO_DATA guard pre-set.
 *
 * The seed itself refuses to run unless DEMO_DATA=1 (so it can never wipe a
 * real studio database by accident) and requires DEMO_STAFF_PASSWORD and
 * DEMO_CUSTOMER_PASSWORD — each at least 12 characters — from the real process
 * environment; the seed never reads a .env file itself. This wrapper is the
 * documented entry point: it loads the repository's .env.local and .env (a
 * genuine environment variable always wins), sets DEMO_DATA=1, and runs the
 * seed from the repository root.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(repoRoot, file))
  } catch {
    /* the file is optional */
  }
}

const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const result = spawnSync(process.execPath, [tsxCli, path.join(repoRoot, 'prisma', 'seed.ts')], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, DEMO_DATA: '1' },
})
if (result.error) {
  console.error(`db:seed — could not start the seed: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
