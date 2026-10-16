/** Plain-language outcomes shown after a settings action lands back on a page. */
export const SETTINGS_DONE_MESSAGES: Record<string, string> = {
  rules:
    'Rental rules are saved — every price and policy now reads the new values, in the studio and on the storefront.',
  hours: 'Business hours are saved — the storefront shows them and the inquiry reply clock follows them.',
  zones: 'Delivery zones are saved — checkout offers them with their courier fees.',
  template: 'The email template is saved — every future send uses the new copy.',
  template_reset: 'The template is back to the factory copy.',
  test_sent: 'Test email sent to your studio address.',
  invited: 'Invitation sent — the temporary password is shown above and was emailed to them.',
  active: 'Staff account updated.',
  role: 'Role updated — the change applies from their next request.',
  password_reset: 'Password reset — the temporary password is shown above and was emailed to them.',
  two_factor_required: 'Two-factor requirement updated.',
  two_factor_reset: 'Authenticator cleared — the account re-enrolls at next sign-in.',
}
