# Supabase backend

Production project ref: `hvyrairuogiljplmsuat`

Deployed Edge Function: `wiener-api`

Applied migrations:
- `20260820162546_initial_wiener_farm_schema`
- `20260820162628_secure_reward_rpcs`
- `20260820162735_admin_bootstrap_and_bot_identity`
- `20260820162800_admin_operations_and_broadcasts`
- `20260820162818_adsgram_secure_callback_config`
- `add_missing_lookup_indexes`

Security notes:
- RLS is enabled on all app tables.
- Direct access for `anon` and `authenticated` database roles is revoked.
- The frontend talks only to the `wiener-api` Edge Function for privileged operations.
- Balance/reward/withdrawal/admin mutations run on the server.
- Telegram Mini App `initData` is signature-verified server-side.
- Never commit `TELEGRAM_BOT_TOKEN`, service-role credentials, callback secrets, or bootstrap secrets.
