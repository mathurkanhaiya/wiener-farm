#!/usr/bin/env bash
set -euo pipefail
cd /opt/wiener-code
BACKEND=/opt/wiener-backend/server.mjs
[[ -f "$BACKEND" ]] || BACKEND=/opt/wiener-backend/server.js
STAMP=$(date +%Y%m%d-%H%M%S)
BB="$BACKEND.v113-adsgram-unlimited-$STAMP.bak"
FB="src/AdsPage.tsx.v113-$STAMP.bak"
[[ -f "$BACKEND" && -f src/AdsPage.tsx ]] || { echo "ERROR: required files missing"; exit 1; }
node --check "$BACKEND"
cp -a "$BACKEND" "$BB"; cp -a src/AdsPage.tsx "$FB"
rollback(){ cp -a "$BB" "$BACKEND"; cp -a "$FB" src/AdsPage.tsx; pm2 restart wiener-api --update-env >/dev/null 2>&1 || true; }
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
p=Path('/opt/wiener-backend/server.mjs')
if not p.exists(): p=Path('/opt/wiener-backend/server.js')
s=p.read_text()
# Remove V111 reward reducer middleware only. Original AdsGram start/complete callback route remains untouched.
a=s.find('// === WIENER MAIN AD STRICT DYNAMIC V111 ===')
b=s.find('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
if a>=0 and b>=0:
    b += len('// === END WIENER MAIN AD STRICT DYNAMIC V111 ===')
    s=s[:a]+s[b:]
s=s.replace("app.use('/functions/v1/wiener-ad',mainAdStrictV111());\n",'')
p.write_text(s)

f=Path('/opt/wiener-code/src/AdsPage.tsx')
x=f.read_text()
# Main AdsGram: keep start -> SDK show completion -> backend complete callback -> credit.
x=x.replace("import {trackAdInteraction} from './adInteraction';\n",'')
x=x.replace("if(src==='main'&&used>=Number(s.daily_ad_limit||0)){say('Daily ad limit reached');return}",'')
x=x.replace("const tracker=trackAdInteraction({allowBlur:true,minBlurMs:5000});try{setBusy(src);setResult(null);",
            "try{setBusy(src);setResult(null);")
old="tracker.start();const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const visitMs=tracker.interactionMs();const visited5s=visitMs>=5000;const st=await adApi('complete',{session_id:x.session_id,interacted:visited5s} as any);"
new="const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const st=await adApi('complete',{session_id:x.session_id} as any);"
if old not in x: raise SystemExit('ERROR: main AdsGram flow anchor changed')
x=x.replace(old,new,1)
# Secondary keeps its existing behavior; create its tracker locally only if secondary is used.
old2="const x=await secondaryAdApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||'int-44228')});if(!c)throw Error('AdsGram SDK unavailable');tracker.start();const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const visitMs=tracker.interactionMs();const visited5s=visitMs>=5000;const st:any=await secondaryAdApi('reward',{session_id:x.session_id,interacted:visited5s} as any);"
new2="const x=await secondaryAdApi('start');const c=window.Adsgram?.init({blockId:String(x.block_id||'int-44228')});if(!c)throw Error('AdsGram SDK unavailable');const shown=await c.show();if(shown&&shown.done===false)throw Error(shown.description||'Ad was not completed');const st:any=await secondaryAdApi('reward',{session_id:x.session_id} as any);"
if old2 in x: x=x.replace(old2,new2,1)
x=x.replace("}finally{tracker.stop();setBusy(null)}};","}finally{setBusy(null)}};")
x=x.replace("const mainAtLimit=used>=Number(s.daily_ad_limit||0),secondAtLimit=second.used>=second.limit;",
            "const mainAtLimit=false,secondAtLimit=second.used>=second.limit;")
x=x.replace("<h3>AdsGram — {s.daily_ad_limit} ads</h3><p>{Number(s.ad_reward||5)} WIENER · {used}/{s.daily_ad_limit} today</p>",
            "<h3>AdsGram — Unlimited</h3><p>{Number(s.ad_reward||5)} WIENER · {used} completed today</p>")
# Clean legacy V109/V110 result UI that can survive earlier prebuilds.
x=x.replace("type Result={source:Source;reward:number;bonus_unlocked:boolean;interaction_detected:boolean};","type Result={source:Source;reward:number};")
x=x.replace("const finish=(src:Source,st:any)=>setResult({source:src,reward:Number(st?.reward||0),bonus_unlocked:!!(st?.bonus_unlocked??st?.interaction_detected),interaction_detected:!!st?.interaction_detected});","const finish=(src:Source,st:any)=>setResult({source:src,reward:Number(st?.reward||0)});")
x=x.replace("mainAtLimit?'DAILY LIMIT REACHED':",'')
x=x.replace('<div className="wf-ad-heading"><h2>Ads Task</h2><span>Daily rewards</span></div>','<div className="wf-ad-heading"><h2>Ads Task</h2><span>Unlimited rewards</span></div>')
# V109/V110 newer card: remove visible 4/50 progress + progress bar entirely.
import re
x=re.sub(r'<div className="wf-ad-progress-label"><span>Today\'s progress</span><b>\{used\} / \{s\.daily_ad_limit\}</b></div><div className="wf-ad-progress"[^>]*>.*?</div>','<div className="wf-ad-progress-label"><span>Completed today</span><b>{used}</b></div>',x,count=1)
# No result modal for main AdsGram. Successful callback credits reward, refreshes balance and returns to Ads page.
x=x.replace("const finish=(src:Source,st:any)=>setResult({source:src,reward:Number(st?.reward||0)});","const finish=(src:Source,st:any)=>{if(src!=='main')setResult({source:src,reward:Number(st?.reward||0)})};")
start=x.find('{result&&<div className="ad-result-backdrop">')
if start>=0:
    end=x.find('</>;',start)
    if end<0: raise SystemExit('ERROR: V113 result popup end anchor missing')
    popup='{result&&<div className="ad-result-backdrop"><div className="ad-result-card bonus"><div className="ad-result-badge">✅</div><small>AD COMPLETED</small><div className="ad-result-earned">+{result.reward} WIENER</div><h3>Reward credited successfully.</h3><button className="primary" type="button" onClick={()=>setResult(null)}>WATCH NEXT / CLOSE</button></div></div>}'
    x=x[:start]+popup+x[end:]
f.write_text(x)
print('V113 source/backend patch applied')
PY

node --check "$BACKEND"
grep -Fq "const mainAtLimit=false" src/AdsPage.tsx
grep -Fq "AdsGram — Unlimited" src/AdsPage.tsx
! grep -Fq "result.full_reward" src/AdsPage.tsx
! grep -Fq "3-second advertiser visit detected" src/AdsPage.tsx
! grep -Fq "Today's progress" src/AdsPage.tsx
grep -Fq "if(src!=='main')setResult" src/AdsPage.tsx
! grep -Fq "mainAdStrictV111" "$BACKEND"
npm run build
npm run typecheck
pm2 restart wiener-api --update-env
sleep 3
curl -fsS http://127.0.0.1:3000/health
echo
pm2 save
trap - ERR
echo "=== V113 READY ==="
echo "Main AdsGram: WATCH -> loading -> completed AdsGram callback -> full configured reward."
echo "Main daily limit UI/check removed. Original backend callback route remains."
echo "No visibility-loss reward reduction remains."
