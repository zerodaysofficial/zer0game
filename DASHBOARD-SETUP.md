# ZER0GAME Neon Dashboard + Email Accounts

This branch contains a responsive dashboard based on the requested purple gaming UI. The original site stays accessible at classic.html. The owner admin panel, PKG builder, games.json, cover links, Game/DLC/Cheat URLs, lock.html, and download counters remain available.

## Enable real registrations and OTP emails

Email registration cannot safely be handled by GitHub Pages alone. The secure account features need a separately configured Supabase Auth project. They are intentionally disabled when configuration is absent.

1. Create a Supabase project controlled by the site owner. Enable Auth → Email, disable anonymous sign-in, configure the actual GitHub Pages HTTPS Site URL and redirect allow-list.
2. In Auth → Email Templates → Magic Link/OTP, put a six-digit verification code in the email using the literal variable {{ .Token }} (for example: <p>Your Zer0Game code: {{ .Token }}</p>). Supabase generates and verifies the code on its backend; the browser never contains the actual code.
3. Configure a verified production SMTP sender, appropriate IP/user rate limits, CAPTCHA or Turnstile where possible, and an appropriately short OTP expiry such as 10 minutes.
4. In Supabase SQL Editor execute supabase/schema.sql. It creates per-user profiles, favorites, and activity_events with Row Level Security and a public avatar bucket that only allows logged-in users to upload into their own folder.
5. Edit auth-config.js with the project HTTPS URL and Supabase *publishable/anon public key only*. Never commit a service_role key, SMTP password, GitHub PAT, or JWT secret.
6. Validate new user sign-up, bad/expired/replayed codes, two-user RLS isolation and file upload permissions before merging into main.

New registrations NEVER grant admin access. There is no admin field in the account tables. The original admin.html continues to require GitHub repository-owner authorization and its existing GitHub token mechanism.

## Validation checklist

- [ ] Public guests can search by title, PPSA, firmware, language and genre.
- [ ] Status, cheat and DLC filters show only qualifying catalog entries.
- [ ] The Game, DLC and Cheat buttons use the exact existing links in games.json through lock.html.
- [ ] Existing Game/Cheat click counters display values when the external counter API is available.
- [ ] A new user's email receives a six-digit OTP; the code is absent from the HTML, JavaScript, console and database policies.
- [ ] Invalid, expired, replayed and rate-limited verification attempts fail.
- [ ] Registered users cannot access or modify any other user's profile, favorites, activities or avatar upload folder.
- [ ] Profile display name, JPG/PNG/WebP avatar under 2MB, private favorites and recent game/cheat search and download-click activity work.
- [ ] My Profile → Clear My Activity actually removes saved history.
- [ ] The existing admin editor works for the GitHub owner, but no Supabase signup can grant GitHub write permissions.
- [ ] Desktop, mobile, keyboard navigation and dialogs work.
- [ ] Privacy notice is reviewed for any jurisdiction-specific obligations before inviting sign-ups.

**Progress**: the UI and secure-auth integration code are ready for review; no Supabase project has yet been configured, and no live email delivery or end-to-end signup tests have been performed.

Note: external download hosts do not provide real progress data to GitHub Pages. The concept's Downloading percentage was intentionally replaced with an authentic recent-activity panel.

Docs:
https://supabase.com/docs/guides/auth/auth-email-passwordless
https://supabase.com/docs/guides/auth/rate-limits
https://supabase.com/docs/guides/storage/security/access-control

Run all repository tests after checkout using node --test tests/*.test.mjs.