/**
 * Email delivery safety — the deployment contract.
 *
 * A serverless filesystem is read-only, so production must never try to write
 * the development outbox. Without RESEND_API_KEY the message is skipped with a
 * warning and health says so; nothing about a booking may fail because email
 * is unavailable.
 */
import { readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { emailProvider, sendEmail } from '@/lib/email/send'

const originalKey = process.env.RESEND_API_KEY
const originalEnv = process.env.NODE_ENV
const originalOutboxDir = process.env.OUTBOX_DIR

/** NODE_ENV is typed readonly; these tests still need to flip it. */
function setNodeEnv(value: string) {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

function tempOutbox(): string {
  return path.join(os.tmpdir(), `mr-email-test-${randomUUID()}`)
}

afterEach(() => {
  if (originalKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = originalKey
  if (originalEnv !== undefined) setNodeEnv(originalEnv)
  if (originalOutboxDir === undefined) delete process.env.OUTBOX_DIR
  else process.env.OUTBOX_DIR = originalOutboxDir
})

describe('emailProvider', () => {
  it('reports the outbox in development with no key', () => {
    delete process.env.RESEND_API_KEY
    setNodeEnv('development')
    expect(emailProvider()).toBe('outbox')
  })

  it('reports disabled in production with no key — never the outbox', () => {
    delete process.env.RESEND_API_KEY
    setNodeEnv('production')
    expect(emailProvider()).toBe('disabled')
  })

  it('prefers Resend whenever a key is present', () => {
    process.env.RESEND_API_KEY = 're_test_key'
    setNodeEnv('production')
    expect(emailProvider()).toBe('resend')
  })
})

describe('sendEmail without a provider key', () => {
  it('skips in production without throwing and writes nothing to disk', async () => {
    delete process.env.RESEND_API_KEY
    setNodeEnv('production')
    const outbox = tempOutbox()
    process.env.OUTBOX_DIR = outbox

    const result = await sendEmail({
      to: 'customer@example.com',
      subject: 'Your reservation',
      html: '<p>Hi</p>',
      text: 'Hi',
      kind: 'booking_received',
    })

    expect(result.provider).toBe('disabled')
    expect(result.delivered).toBe(false)
    await expect(readdir(outbox)).rejects.toThrow() // the folder was never created
  })

  it('still writes the local outbox in development', async () => {
    delete process.env.RESEND_API_KEY
    setNodeEnv('development')
    const outbox = tempOutbox()
    process.env.OUTBOX_DIR = outbox

    const result = await sendEmail({
      to: 'customer@example.com',
      subject: 'Your reservation',
      html: '<p>Hi</p>',
      text: 'Hi',
      kind: 'booking_received',
    })

    expect(result.provider).toBe('outbox')
    const files = await readdir(outbox)
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(1)
  })
})
