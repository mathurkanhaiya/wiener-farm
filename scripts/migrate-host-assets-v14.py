from pathlib import Path
import subprocess, urllib.request, urllib.parse

DEST=Path('/opt/wiener-host-assets')
DEST.mkdir(parents=True,exist_ok=True)
q="select name,coalesce(storage_path,name),coalesce(content_type,'application/octet-stream') from public.hosted_assets order by name"
try:
    out=subprocess.check_output(['runuser','-u','postgres','--','psql','-d','wiener_farm_final','-At','-F','\t','-c',q],text=True,stderr=subprocess.STDOUT)
except subprocess.CalledProcessError as e:
    print('Hosted asset inventory unavailable:',e.output.strip())
    raise SystemExit(0)
rows=[line.split('\t') for line in out.splitlines() if line.strip()]
ok=skip=fail=0
base='https://hvyrairuogiljplmsuat.supabase.co/storage/v1/object/public/wiener-host/'
for row in rows:
    if len(row)<2: continue
    name,path=row[0].strip().lower(),row[1].strip()
    if not name or '/' in name or '..' in name: continue
    dest=DEST/name
    if dest.exists() and dest.stat().st_size>0:
        skip+=1; continue
    try:
        url=base+urllib.parse.quote(path,safe='/')
        req=urllib.request.Request(url,headers={'User-Agent':'Wiener-VPS-Migration/1.0'})
        with urllib.request.urlopen(req,timeout=20) as r:
            data=r.read(20*1024*1024+1)
        if len(data)>20*1024*1024: raise ValueError('asset_too_large')
        dest.write_bytes(data); ok+=1
    except Exception as e:
        fail+=1; print('asset copy failed',name,str(e)[:160])
print(f'Hosted assets: copied={ok} existing={skip} failed={fail} total={len(rows)}')
