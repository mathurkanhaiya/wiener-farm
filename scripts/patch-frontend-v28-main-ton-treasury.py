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

# Replace only MoneyCenter with a known-valid block. This avoids fragile bracket
# insertion while preserving every unrelated local AdminHub customization.
m=re.search(r"function MoneyCenter\(\{d,setD,say,reload\}.*?(?=\nfunction WithdrawalOverview)",s,re.S)
if not m: raise SystemExit('ERROR: MoneyCenter block missing')
block="""function MoneyCenter({d,setD,say,reload}:{d:any;setD:any;say:any;reload:any}){const [tab,setTab]=useState<MoneyTab>('treasury');return <div className=\"adminx-page\"><Subnav value={tab} setValue={setTab} items={[[\"treasury\",\"Main Treasury\"],[\"withdrawals\",\"Withdrawals\"],[\"payouts\",\"Payout Control\"],[\"rewards\",\"Rewards\"],[\"internal\",\"Internal Transfer\"]]}/>{tab==='treasury'&&<section className=\"adminx-embed\"><MainTreasuryAdmin say={say}/></section>} {tab==='withdrawals'&&<WithdrawalOverview rows={d.withdrawals||[]}/>} {tab==='rewards'&&<RewardSettings value={d.settings} setValue={(v:any)=>setD({...d,settings:v})} say={say} reload={reload}/>} {tab==='payouts'&&<section className=\"adminx-embed\"><AdminWithdrawUpgrade say={say}/></section>} {tab==='internal'&&<section className=\"adminx-embed\"><InternalTransferAdmin say={say}/></section>}</div>}"""
s=s[:m.start()]+block+s[m.end():]
if 'items={[["treasury","Main Treasury"],["withdrawals","Withdrawals"]' not in s:
    raise SystemExit('ERROR: Main Treasury MoneyCenter validation failed')
admin.write_text(s)

if withdraw.exists():
    w=withdraw.read_text()
    old='<div className="method-admin-grid">{d.methods.map((m:any)=><div className="method-admin-card"'
    new='<div className="method-admin-grid">{d.methods.filter((m:any)=>m.network===\'TON\'||m.method_key===\'gram_ton\').map((m:any)=><div className="method-admin-card"'
    if old in w:
        w=w.replace(old,new,1)
        withdraw.write_text(w)

print('V28 frontend patched without overwriting unrelated local changes')
