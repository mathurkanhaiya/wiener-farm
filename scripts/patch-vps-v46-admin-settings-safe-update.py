#!/usr/bin/env python3
from pathlib import Path
import os

p=Path(os.environ.get("WIENER_BACKEND_FILE","/opt/wiener-backend/server.mjs"))
if not p.exists():
    alt=Path("/opt/wiener-backend/server.js")
    if alt.exists(): p=alt

s=p.read_text()
TAG="WIENER ADMIN SETTINGS SAFE UPDATE V46"
if TAG in s:
    print("V46 admin settings safe update already installed")
    raise SystemExit(0)

needle="if(action==='admin_settings_save'){"
if needle not in s:
    raise SystemExit("ERROR: admin_settings_save handler not found")

safe=r'''if(action==='admin_settings_save'){
      const input=(b.settings&&typeof b.settings==='object'&&!Array.isArray(b.settings))?b.settings:{};
      const blocked=new Set([
        'id','updated_at',
        'telegram_webhook_secret','notification_cron_secret','adsgram_reward_secret_hash',
        'bot_webhook_synced_at','payout_last_config_check_at','payout_low_balance_last_alert_at',
        'payout_last_alert_reason','treasury_last_scan_block',
        'sponsored_min_reward','sponsored_max_reward'
      ]);
      const cols=(await pool.query(`
        select column_name,data_type,udt_name
        from information_schema.columns
        where table_schema='public' and table_name='app_settings'
      `)).rows;
      const known=new Map(cols.map(x=>[String(x.column_name),x]));
      const seen=new Set(),sets=[],vals=[],saved={};
      for(const [key,val] of Object.entries(input)){
        if(blocked.has(key)||seen.has(key)||val===undefined)continue;
        if(!/^[a-z][a-z0-9_]*$/.test(key)||!known.has(key))continue;
        seen.add(key);
        const meta=known.get(key),idx=vals.length+1;
        if(meta.data_type==='jsonb'){
          vals.push(JSON.stringify(val??null));
          sets.push(`"${key}"=$${idx}::jsonb`);
        }else{
          vals.push(val);
          sets.push(`"${key}"=$${idx}`);
        }
        saved[key]=val;
      }
      if(!sets.length){
        const cur=(await pool.query(`select * from public.app_settings where id=true limit 1`)).rows[0]||{};
        return res.json({ok:true,data:cur});
      }
      sets.push('updated_at=now()');
      const q=await pool.query(`update public.app_settings set ${sets.join(',')} where id=true returning *`,vals);
      try{await audit18(id,'settings_update',null,{keys:Object.keys(saved)})}catch{}
      return res.json({ok:true,data:q.rows[0]||{}});
    }
    if(action==='__admin_settings_save_legacy_v46'){'''
s=s.replace(needle,safe,1)

marker="// === WIENER ADMIN SETTINGS SAFE UPDATE V46 ==="
fallback="\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"
if fallback in s:
    s=s.replace(fallback,"\n"+marker+"\n"+fallback,1)
else:
    s+="\n"+marker+"\n"

p.write_text(s)
print("V46 installed: admin settings patch updates each column once and ignores read-only/sensitive fields")
