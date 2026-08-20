# WIENER FARM

Secure Telegram Mini App farming/reward platform for `@WienerDogeFarmBot`.

## Stack
- React + TypeScript + Vite
- Supabase Postgres + RLS + Edge Functions
- Telegram Mini App signed initData verification
- AdsGram server Reward URL verification
- Vercel frontend

## Security model
All balance-changing operations are server-side. Public database tables have RLS enabled and direct anon/authenticated table access revoked. Telegram initData is cryptographically verified before user actions. Ads are credited only after the AdsGram server reward callback. Admin actions require a server-side admin role and are audit logged.

## Required private secret
Store the Telegram bot token as `TELEGRAM_BOT_TOKEN` for the `wiener-api` Edge Function, or configure Telegram Bot ID for third-party signature validation (task membership checks and broadcasts still require the token).
