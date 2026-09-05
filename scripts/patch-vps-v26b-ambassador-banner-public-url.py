from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
old="return {asset,url:`https://api.viralaitools.xyz/host/${asset}`,size:stat.size};"
new="const st=await settingsV14();const base=String(st.app_url||'https://wiener.viralaitools.xyz').replace(/\\\/$/,'');return {asset,url:`${base}/api/host/${asset}`,size:stat.size};"

if old in s:
    s=s.replace(old,new,1)
    p.write_text(s)
    print('V26B fixed Ambassador generated-banner public URL')
elif "/api/host/${asset}" in s:
    print('V26B already installed')
else:
    raise SystemExit('ERROR: Ambassador banner URL anchor not found')
