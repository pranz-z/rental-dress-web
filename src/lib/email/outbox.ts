/**
 * The local outbox.
 *
 * In development without a transactional-email key, every message the studio
 * or the storefront sends is written here as a JSON file and listed at
 * /studio/dev/outbox. Production never writes it: a serverless filesystem is
 * read-only (and /tmp dies with the instance), so `sendEmail` skips delivery
 * with a warning instead of pretending the message was stored anywhere.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type OutboxMessage = {
  id: string
  to: string
  toName?: string
  from: string
  subject: string
  html: string
  text: string
  kind: string
  reference?: string
  replyTo?: string
  createdAt: string
  provider: 'outbox' | 'resend'
  /** Set when a configured provider refused the message. */
  error?: string
}

export function outboxDir(): string {
  return process.env.OUTBOX_DIR || path.join(process.cwd(), 'var', 'outbox')
}

function fileName(message: OutboxMessage): string {
  const stamp = message.createdAt.replaceAll(':', '-').replace(/\..+$/, '')
  const slug = message.kind.replaceAll(/[^a-z0-9_-]/gi, '-').slice(0, 40)
  return `${stamp}__${slug}__${message.id.slice(0, 8)}.json`
}

export async function writeOutboxMessage(message: OutboxMessage): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    // Defence in depth: nothing may try to persist an email to the local
    // filesystem in production. The outbox page is unreachable there too.
    console.warn('[email] refused to write the development outbox in production')
    return
  }
  const dir = outboxDir()
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileName(message)), JSON.stringify(message, null, 2), 'utf8')
}

/** Newest first, capped so the studio page stays quick. */
export async function listOutboxMessages(limit = 100): Promise<OutboxMessage[]> {
  const dir = outboxDir()
  let files: string[]
  try {
    // The outbox file is deliberately outside the traced bundle; the ignore
    // hint keeps the whole project from being packaged with the server.
    files = await readdir(/* turbopackIgnore: true */ dir)
  } catch {
    return []
  }
  const picks = files.filter((file) => file.endsWith('.json')).sort().reverse().slice(0, limit)
  const messages: OutboxMessage[] = []
  for (const file of picks) {
    try {
      messages.push(
        JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ dir, file), 'utf8')) as OutboxMessage,
      )
    } catch {
      /* a half-written file is skipped, never fatal */
    }
  }
  return messages.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function newOutboxId(): string {
  return randomUUID()
}
