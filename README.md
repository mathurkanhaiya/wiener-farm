# WIENER FARM

Secure Telegram Mini App farming/reward platform for `@WienerDogeFarmBot`.

## Production
- App: https://wiener-farm.vercel.app
- Backend: Supabase project `hvyrairuogiljplmsuat` (Mumbai / ap-south-1)
- API: Supabase Edge Function `wiener-api`

## Stack
- React + TypeScript + Vite
- Supabase Postgres + RLS + Edge Functions
- Telegram Mini App signed initData verification
- AdsGram server Reward URL verification
- Vercel frontend

## Features
Home farming, daily streaks, promo codes, server-verified rewarded ads, task categories, referrals and lifetime commission, wallet and withdrawals, transaction history, ban/maintenance screens, and a protected admin console for app settings, users, tasks, promo codes, withdrawals, admins and audit logs.

## Security model
All balance-changing operations are server-side. Public database tables have RLS enabled and direct anon/authenticated table access revoked. Telegram initData is cryptographically verified before user actions. Ads are credited only after the AdsGram server reward callback. Admin actions require a server-side admin role and are audit logged.

## Required private secret
Store the Telegram bot token as `TELEGRAM_BOT_TOKEN` for the `wiener-api` Edge Function. It is required for Telegram task membership verification and bot broadcasts. Never commit the bot token, service-role key, AdsGram callback secret or owner bootstrap code to GitHub.

## Local frontend development

Run `npm install`, then `npm run dev`. Vite listens on all interfaces and
accepts Arena preview hosts. Browser API calls stay same-origin: Vite forwards
`/functions/v1` and `/api/host` to the configured VPS and other `/api` calls to
the deployed Vercel app (including the games feed).

**These proxies use live services, not a sandbox.** Use a test account and avoid
real reward, withdrawal, or admin mutations while developing. Signed Telegram
features still require a valid Telegram Mini App session; ordinary browsers
show guest mode.

Validation: `npm run typecheck`, `npm run build`, and
`node --test tests/*.test.mjs`. The existing tests cover referral verification;
they do not replace Telegram end-to-end or browser accessibility testing.
