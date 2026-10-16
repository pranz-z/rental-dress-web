// Minimal .env loader for the standalone Node scripts (Next loads .env itself).
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnv(root = process.cwd()) {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(root, file)
    if (!existsSync(path)) continue
    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
  return process.env
}
