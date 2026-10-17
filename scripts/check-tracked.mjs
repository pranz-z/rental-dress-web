/**
 * Fails if a file that must never be committed is tracked by git — and if a
 * retired demo password ever reappears in a tracked file's contents.
 *
 * Run from any repo checkout: `npm run check:tracked`. The CI workflow calls it
 * on every push, right after checkout, so a leaked .env, outbox file, local
 * data directory or hardcoded credential stops the pipeline before anything
 * else runs.
 */
import { spawnSync } from 'node:child_process'

const protectedPatterns = [
  { label: 'environment file', test: (path) => /(^|\/)\.env($|\.)/.test(path) && path !== '.env.example' },
  { label: 'local data directory', test: (path) => /(^|\/)\.data\//.test(path) },
  { label: 'local email outbox', test: (path) => /(^|\/)var\//.test(path) || path.endsWith('.outbox.json') },
  { label: 'secret material', test: (path) => /\.(pem|key|p12)$/.test(path) },
  { label: 'database dump', test: (path) => /\.(dump|sql\.gz)$/.test(path) },
]

const listed = spawnSync('git', ['ls-files'], { encoding: 'utf8' })
if (listed.status !== 0) {
  console.error('check:tracked — `git ls-files` failed. Run this inside the repository.')
  process.exit(1)
}

const tracked = listed.stdout.split(/\r?\n/).filter(Boolean)
const offenders = []

for (const path of tracked) {
  for (const pattern of protectedPatterns) {
    if (pattern.test(path)) offenders.push({ path, label: pattern.label })
  }
}

if (offenders.length > 0) {
  console.error('check:tracked — these files are tracked but must never be committed:\n')
  for (const offender of offenders) {
    console.error(`  ✗ ${offender.path}  (${offender.label})`)
  }
  console.error('\nRemove them with `git rm --cached <path>`, add a .gitignore rule, then retry.')
  process.exit(1)
}

// ── content scan: retired demo passwords must never come back ─────────────
//
// These literal passwords were once hardcoded in the seed (and shipped in git
// history); every tracked file must stay free of them. The patterns are built
// from parts so this script cannot match itself, and `git grep` reads only
// tracked files.
const retiredDemoPasswords = ['Maison', 'Elena', 'Camille'].map((name) => `${name}2026!`)
const grepArgs = ['grep', '-n', '-i', '-I', ...retiredDemoPasswords.flatMap((password) => ['-e', password])]
const found = spawnSync('git', grepArgs, { encoding: 'utf8' })
if (found.status === 0) {
  console.error('check:tracked — a retired demo password reappeared in a tracked file:\n')
  console.error(found.stdout.trimEnd())
  console.error('\nDelete the literal (and rotate the password again if it was ever used for real).')
  process.exit(1)
}
if (found.status !== 1) {
  console.error('check:tracked — `git grep` failed; cannot verify the retired demo passwords are gone.')
  process.exit(1)
}

console.log(`check:tracked — ${tracked.length} tracked files, no secrets, data directories, outbox files or retired demo passwords.`)
