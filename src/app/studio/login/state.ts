/** Shared shape between the sign-in server actions and the form component. */
export type SignInState = {
  step: 'credentials' | 'password' | 'enroll' | 'code'
  error?: string
  email?: string
  /** QR data URL shown while enrolling an authenticator. */
  qrDataUrl?: string
  /** The base32 key, for people who add the account by hand. */
  totpKey?: string
}

export const initialSignInState: SignInState = { step: 'credentials' }
