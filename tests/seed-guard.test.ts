/**
 * `prisma/seed.ts` must refuse to touch anything unless the demo contract is
 * satisfied: DEMO_DATA=1 plus DEMO_STAFF_PASSWORD and DEMO_CUSTOMER_PASSWORD,
 * each at least 12 characters, all from the real process environment.
 *
 * Each case runs the seeder in a child process with
 *
 *   • a clean environment — no DEMO_* variables inherited from the shell,
 *   • a working directory outside the repository, so no .env file is even
 *     reachable (the seed deliberately reads no .env files itself), and
 *   • DATABASE_URL naming a database that does not exist, so a broken guard
 *     would surface as a Prisma error instead of a silent wipe;
 *
 * and a refusing run must exit 1, explain itself on stderr and show no sign
 * of having reached the database.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { hasDatabase } from './helpers'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const seedPath = path.join(repoRoot, 'prisma', 'seed.ts')

/** A database that does not exist — the child can never write anywhere real. */
const PROBE_DATABASE = 'maison_reve_seed_guard_probe'

function probeUrl(): string {
  const base = process.env.DATABASE_URL ?? ''
  if (!base.startsWith('postgres')) {
    return `postgresql://zztest:zztest@127.0.0.1:1/${PROBE_DATABASE}`
  }
  const url = new URL(base)
  url.pathname = `/${PROBE_DATABASE}`
  return url.toString()
}

/** The minimum a Node child process needs on Windows and POSIX. */
const BABY_ENV = ['PATH', 'SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME']

function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string> = { DATABASE_URL: probeUrl() }
  for (const key of BABY_ENV) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  // Next's type augmentation makes NODE_ENV required on ProcessEnv; the seed
  // child deliberately starts without one.
  return { ...env, ...extra } as NodeJS.ProcessEnv
}

const DATABASE_ACTIVITY = /prisma:error|P100\d|does not exist|ECONNREFUSED|EADDRNOTAVAIL/i

let sandbox = ''
let demoStaffBefore = -1
let demoCustomerBefore = -1

beforeAll(async () => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'maison-reve-seed-guard-'))
  if (hasDatabase) {
    demoStaffBefore = await prisma.staffUser.count({ where: { email: 'isabelle@maisonreve.com' } })
    demoCustomerBefore = await prisma.customer.count({ where: { email: 'camille.dubois@gmail.com' } })
  }
})

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
})

function runSeed(extra: Record<string, string>) {
  const result = spawnSync(process.execPath, [tsxCli, seedPath], {
    cwd: sandbox,
    env: cleanEnv(extra),
    encoding: 'utf8',
    timeout: 20_000,
  })
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

function expectRefusal(run: ReturnType<typeof runSeed>, ...needles: string[]) {
  expect(run.status).toBe(1)
  for (const needle of needles) expect(run.output).toContain(needle)
  expect(run.output).not.toContain('Seeding the Maison Rêve studio')
  expect(run.output).not.toMatch(DATABASE_ACTIVITY)
}

describe.skipIf(!existsSync(tsxCli))('demo seed guard', () => {
  it('refuses to run without DEMO_DATA', () => {
    expectRefusal(runSeed({}), 'DEMO_DATA')
  })

  it('refuses when DEMO_DATA=1 but no passwords are set', () => {
    expectRefusal(runSeed({ DEMO_DATA: '1' }), 'DEMO_STAFF_PASSWORD', 'not committed to the repository')
  })

  it('refuses a staff password shorter than 12 characters', () => {
    expectRefusal(
      runSeed({ DEMO_DATA: '1', DEMO_STAFF_PASSWORD: 'tiny', DEMO_CUSTOMER_PASSWORD: 'a-long-enough-one' }),
      'DEMO_STAFF_PASSWORD is only 4 characters',
      'at least 12 characters',
    )
  })

  it('refuses a customer password shorter than 12 characters', () => {
    expectRefusal(
      runSeed({ DEMO_DATA: '1', DEMO_STAFF_PASSWORD: 'a-long-enough-one', DEMO_CUSTOMER_PASSWORD: 'short' }),
      'DEMO_CUSTOMER_PASSWORD is only 5 characters',
      'at least 12 characters',
    )
  })

  it('lets a fully satisfied contract through to the database step (control)', () => {
    const run = runSeed({
      DEMO_DATA: '1',
      DEMO_STAFF_PASSWORD: 'a-long-enough-one',
      DEMO_CUSTOMER_PASSWORD: 'another-long-enough-one',
    })
    // The probe database does not exist, so the seed fails *past* the guard.
    expect(run.output).toContain('Seeding the Maison Rêve studio')
    expect(run.output).toMatch(DATABASE_ACTIVITY)
    expect(run.status).not.toBe(0)
  })

  it.skipIf(!hasDatabase)('leaves the studio database unchanged', async () => {
    expect(await prisma.staffUser.count({ where: { email: 'isabelle@maisonreve.com' } })).toBe(demoStaffBefore)
    expect(await prisma.customer.count({ where: { email: 'camille.dubois@gmail.com' } })).toBe(demoCustomerBefore)
  })
})
