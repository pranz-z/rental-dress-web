/** Shared shape between the sign-in server actions and the form component. */
export type SignInState = {
  step: 'credentials' | 'code'
  error?: string
  email?: string
}

export const initialSignInState: SignInState = { step: 'credentials' }
