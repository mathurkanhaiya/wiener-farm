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
