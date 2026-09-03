#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code

SRC=scripts/patch-vps-v20-ton-config.py
INST=scripts/install-vps-v20-ton-config.sh
TMP_PATCH=/tmp/patch-vps-v20-ton-config-v20b.py
TMP_INST=/tmp/install-vps-v20-ton-config-v20b.sh

[[ -f "$SRC" && -f "$INST" ]] || { echo 'ERROR: V20 source scripts missing' >&2; exit 1; }

echo '=== V20B BUILD COMPATIBLE PATCH ==='
python3 - <<'PY'
from pathlib import Path

src=Path('scripts/patch-vps-v20-ton-config.py').read_text()
old='''# Extend the authoritative V8B cron under its existing advisory lock.
old_cron="""    const [proof,farm,amb,giveaways]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});"""
new_cron="""    const [proof,farm,amb,giveaways,tonTreasury]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runTonTreasuryAuto20()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,ton_treasury:tonTreasury});"""
if old_cron not in s:
    raise SystemExit('ERROR: V8B authoritative cron block not found')
s=s.replace(old_cron,new_cron,1)
'''
new='''# Extend the authoritative cron under its existing advisory lock.
# V11B added legacy_notifications after V8B, so preserve it when present.
cron_v11="""    const [proof,farm,amb,giveaways,legacy_notifications]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runLegacyNotificationsV11B()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,legacy_notifications});"""
cron_v11_ton="""    const [proof,farm,amb,giveaways,legacy_notifications,tonTreasury]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runLegacyNotificationsV11B(),runTonTreasuryAuto20()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,legacy_notifications,ton_treasury:tonTreasury});"""
cron_v8="""    const [proof,farm,amb,giveaways]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways});"""
cron_v8_ton="""    const [proof,farm,amb,giveaways,tonTreasury]=await Promise.all([
      runProofRemindersV8(),runFarmRemindersV8(),runAmbassadorV8(),runGiveawaysV8(),runTonTreasuryAuto20()
    ]);
    return res.json({ok:true,busy:false,proof_reminders:proof,farm_reminders:farm,ambassador:amb,giveaways,ton_treasury:tonTreasury});"""
if cron_v11 in s:
    s=s.replace(cron_v11,cron_v11_ton,1)
    print('V20B cron anchor: V11B legacy notifications preserved')
elif cron_v8 in s:
    s=s.replace(cron_v8,cron_v8_ton,1)
    print('V20B cron anchor: V8B base cron')
elif 'runTonTreasuryAuto20()' in s and 'ton_treasury:tonTreasury' in s:
    print('V20B cron anchor: TON cron already present')
else:
    raise SystemExit('ERROR: compatible authoritative cron block not found')
'''
if old not in src:
    raise SystemExit('ERROR: V20 source cron section changed unexpectedly')
fixed=src.replace(old,new,1)
Path('/tmp/patch-vps-v20-ton-config-v20b.py').write_text(fixed)
print('Compatible V20B patch generated')
PY

python3 - <<'PY'
from pathlib import Path
src=Path('scripts/install-vps-v20-ton-config.sh').read_text()
old='python3 scripts/patch-vps-v20-ton-config.py'
new='python3 /tmp/patch-vps-v20-ton-config-v20b.py'
if old not in src:
    raise SystemExit('ERROR: V20 installer patch invocation not found')
Path('/tmp/install-vps-v20-ton-config-v20b.sh').write_text(src.replace(old,new,1))
PY
chmod +x "$TMP_INST"

echo '=== RUN SAFE V20B INSTALL ==='
bash "$TMP_INST"

echo '=== V20B POST-GATE ==='
grep -Fq 'runLegacyNotificationsV11B(),runTonTreasuryAuto20()' /opt/wiener-backend/server.mjs || {
  echo 'ERROR: legacy notifications + TON treasury cron were not both preserved' >&2
  exit 1
}
node --check /opt/wiener-backend/server.mjs

auto=$(runuser -u postgres -- psql -d wiener_farm_final -Atqc "select coalesce(ton_treasury_autopay_enabled,false) from public.app_settings where id=true")
echo "ton_autopay_after_install=$auto"
[[ "$auto" == "f" ]] || { echo 'ERROR: V20B refuses to finish with TON autopay enabled' >&2; exit 1; }

echo '=== V20B COMPLETE ==='
echo 'Legacy notifications preserved.'
echo 'TON auto-deposit scan installed.'
echo 'TON autopay remains OFF until explicitly confirmed in /config.'
