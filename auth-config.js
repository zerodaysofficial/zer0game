// Public client configuration only. The publishable/anon key is designed for browser use.
// NEVER commit a service_role key, JWT secret, SMTP password, or GitHub admin token.
// Configure email OTP template with {{ .Token }} in Supabase Auth > Email Templates.
export const AUTH_CONFIG = Object.freeze({
  url: '',
  publishableKey: ''
});