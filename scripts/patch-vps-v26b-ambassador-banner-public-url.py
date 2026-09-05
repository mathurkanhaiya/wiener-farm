from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
hardcoded="return {asset,url:`https://api.viralaitools.xyz/host/${asset}`,size:stat.size};"
fixed="const st=await settingsV14();const rawBase=String(st.app_url||'https://wiener.viralaitools.xyz');const base=rawBase.endsWith('/')?rawBase.slice(0,-1):rawBase;return {asset,url:`${base}/api/host/${asset}`,size:stat.size};"

changed=False
if hardcoded in s:
    s=s.replace(hardcoded,fixed,1)
    changed=True
else:
    lines=s.splitlines()
    for i,line in enumerate(lines):
        if "const st=await settingsV14();" in line and "/api/host/${asset}" in line and "return {asset,url:" in line:
            lines[i]="  "+fixed
            s="\n".join(lines)+("\n" if s.endswith("\n") else "")
            changed=True
            break

if changed:
    p.write_text(s)
    print('V26B fixed Ambassador generated-banner public URL')
elif "rawBase.endsWith('/')" in s and "/api/host/${asset}" in s:
    print('V26B already installed')
else:
    raise SystemExit('ERROR: Ambassador banner URL anchor not found')
