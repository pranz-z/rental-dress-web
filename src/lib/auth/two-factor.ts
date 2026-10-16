/**
 * Optional TOTP second factor for studio accounts (RFC 6238, authenticator
 * apps). Owners enable it per staff member from Settings → Staff.
 */
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

authenticator.options = { window: 1 } // tolerate one step of clock drift

const ISSUER = 'Maison Rêve Studio'

export function newTwoFactorSecret(): string {
  return authenticator.generateSecret()
}

export function twoFactorKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret)
}

export async function twoFactorQrDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(twoFactorKeyUri(email, secret), { margin: 1, width: 232 })
}

export function verifyTwoFactor(code: string, secret: string): boolean {
  const token = code.replace(/[\s-]+/g, '')
  if (!/^\d{6}$/.test(token)) return false
  return authenticator.verify({ token, secret })
}
