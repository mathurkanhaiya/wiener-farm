from pathlib import Path
import re

root=Path('/opt/wiener-code')
admin=root/'src/AdminHub.tsx'
withdraw=root/'src/WithdrawV2.tsx'
if not admin.exists(): raise SystemExit('ERROR: src/AdminHub.tsx missing')

s=admin.read_text()
if "import {MainTreasuryAdmin} from './MainTreasuryAdmin';" not in s:
    anchor="import {InternalTransferAdmin} from './InternalTransferAdmin';"
    if anchor not in s: raise SystemExit('ERROR: AdminHub import anchor missing')
    s=s.replace(anchor,anchor+"\nimport {MainTreasuryAdmin} from './MainTreasuryAdmin';",1)

if "'treasury'" not in re.search(r"type MoneyTab=.*?;",s).group(0):
    s=re.sub(r"type MoneyTab=", "type MoneyTab='treasury'|", s, count=1)

# Keep local AdminHub customizations: patch only the MoneyCenter fragments.
m=re.search(r"function MoneyCenter\(\{d,setD,say,reload\}.*?\nfunction WithdrawalOverview",s,re.S)
if not m: raise SystemExit('ERROR: MoneyCenter block missing')
block=m.group(0)
block=block.replace("useState<MoneyTab>('withdrawals')","useState<MoneyTab>('treasury')")
if '["treasury","Main Treasury"]' not in block:
    block=block.replace('items={[[', 'items={[["treasury","Main Treasury"],',1)
if "tab==='treasury'" not in block:
    needle="/>}{tab==='withdrawals'"
    if needle in block:
        block=block.replace(needle,"/>}{tab==='treasury'&&<section className=\"adminx-embed\"><MainTreasuryAdmin say={say}/></section>} {tab==='withdrawals'",1)
    else:
        needle="/>} {tab==='withdrawals'"
        if needle in block:
            block=block.replace(needle,"/>} {tab==='treasury'&&<section className=\"adminx-embed\"><MainTreasuryAdmin say={say}/></section>} {tab==='withdrawals'",1)
        else:
            raise SystemExit('ERROR: MoneyCenter render anchor missing')
s=s[:m.start()]+block+s[m.end()-len('function WithdrawalOverview'):]
admin.write_text(s)

if withdraw.exists():
    w=withdraw.read_text()
    old='<div className="method-admin-grid">{d.methods.map((m:any)=><div className="method-admin-card"'
    new='<div className="method-admin-grid">{d.methods.filter((m:any)=>m.network===\'TON\'||m.method_key===\'gram_ton\').map((m:any)=><div className="method-admin-card"'
    if old in w:
        w=w.replace(old,new,1)
        withdraw.write_text(w)

print('V28 frontend patched without overwriting unrelated local changes')
