/**
 * `npm run db:reseed` — rebuilds the studio database from migrations + seed.
 *
 * Wraps `db-reset.mjs` and `db:setup` with one automatic retry: the embedded
 * PGlite socket server can drop a connection for a moment after app servers
 * shut down, and a reseed runs right after testing. Reseeding is idempotent
 * (it drops and rebuilds from scratch), so a retry is safe.
 */
import { spawnSync } from 'node:child_process'

function attempt() {
  const reset = spawnSync('node scripts/db-reset.mjs', { shell: true, stdio: 'inherit' })
  if (reset.status !== 0) return reset.status ?? 1
  const setup = spawnSync('npm run db:setup', { shell: true, stdio: 'inherit' })
  return setup.status ?? 1
}

let status = attempt()
if (status !== 0) {
  console.log('\n  The embedded Postgres dropped a connection — retrying the reseed once…\n')
  await new Promise((resolve) => setTimeout(resolve, 2500))
  status = attempt()
}
if (status !== 0) {
  console.log(
    '\n  Reseed still failed. The embedded Postgres can wedge if app servers were force-stopped.\n' +
      '  Restart it (stop `npm run db:start`, run it again) then repeat `npm run db:reseed`.\n',
  )
}
process.exit(status)