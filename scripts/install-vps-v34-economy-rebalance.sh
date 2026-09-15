#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${WIENER_DB_NAME:-wiener_farm_final}"

printf '%s\n' '=== WIENER V34 ECONOMY REBALANCE ==='

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
UPDATE public.app_settings
SET ad_reward = 5,
    farm_claim_reward = 10,
    daily_ad_limit = 50
WHERE id = true;

SELECT ad_reward,
       farm_claim_reward,
       daily_ad_limit,
       daily_rewards,
       farm_claim_cooldown_seconds
FROM public.app_settings
WHERE id = true;
SQL

printf '%s\n' '=== V34 READY ==='
printf '%s\n' 'Ad: 5 WIENER | Farm: 10 WIENER | Ad limit: 50/day | Daily unchanged'
