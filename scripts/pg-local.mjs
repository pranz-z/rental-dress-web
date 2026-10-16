/**
 * Local review database.
 *
 * Runs an embedded PostgreSQL (PGlite — the real Postgres engine compiled to
 * WebAssembly) behind a TCP listener that speaks the Postgres wire protocol, so
 * Prisma and `psql`-style clients connect to it exactly as they would to a
 * managed PostgreSQL instance. Data lives outside the project tree (default
 * ~/.maison-reve/pg) because PGlite rewrites its pages on every query and a
 * data directory inside the app would trip the file watcher.
 *
 * Production deployments skip this script entirely: point DATABASE_URL at your
 * managed PostgreSQL and run `npm run db:setup`.
 */
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { loadEnv } from './load-env.mjs'

loadEnv()

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54329/postgres')
const port = Number(url.port || 54329)
const host = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname
const dataDir = process.env.PGLITE_DATA_DIR ?? join(homedir(), '.maison-reve', 'pg')

mkdirSync(dataDir, { recursive: true })

const db = await PGlite.create({ dataDir })
// PGlite is single-connection; the server multiplexes client connections onto it
// so both the app and the maintenance scripts can talk to the same database.
const server = new PGLiteSocketServer({
  db,
  port,
  host,
  id: 'maison-reve-studio',
  maxConnections: Number(process.env.PGLITE_MAX_CONNECTIONS ?? 10),
})
await server.start()

console.log(`  Maison Rêve · local PostgreSQL (embedded) ready`)
console.log(`  → postgresql://${url.username || 'postgres'}:${url.password || 'postgres'}@${host}:${port}${url.pathname || '/postgres'}`)
console.log(`  → data directory: ${dataDir}`)
console.log(`  Press Ctrl+C to stop.`)

let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  console.log('\n  Stopping local PostgreSQL …')
  try {
    await server.stop()
    await db.close()
  } finally {
    process.exit(0)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
