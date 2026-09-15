from pathlib import Path

base=Path('/tmp/v76e-base.py')
if not base.exists():
    raise SystemExit('ERROR: base V76 patch missing in /tmp')

src=base.read_text()
start=src.find("old=\"{command:'start'")
if start<0:
    raise SystemExit('ERROR: brittle V76 command replacement block start not found')
end_marker="s=s.replace(old,new,1)\n"
end=src.find(end_marker,start)
if end<0:
    raise SystemExit('ERROR: brittle V76 command replacement block end not found')
end+=len(end_marker)

replacement = '''sync_anchor="async function internalV18("
if sync_anchor not in s:
    raise SystemExit('ERROR: sync wrapper anchor missing')
override=r"""
// === WIENER USER COMMAND SYNC OVERRIDE V76E ===
const syncTelegramV18Base76E=syncTelegramV18;
syncTelegramV18=async function(){
  const info=await syncTelegramV18Base76E();
  await tgV10('setMyCommands',{commands:[
    {command:'start',description:'Open WIENER home'},
    {command:'wallet',description:'Wallet & withdrawals'},
    {command:'rewards',description:'Reward center'},
    {command:'network',description:'Referral network'},
    {command:'progress',description:'Your progress'},
    {command:'activity',description:'Recent activity'},
    {command:'status',description:'Account status'},
    {command:'profile',description:'VIP profile card'},
    {command:'help',description:'Help & support'}
  ]});
  return info;
};
// === END WIENER USER COMMAND SYNC OVERRIDE V76E ===
"""
s=s.replace(sync_anchor,override+'\\n'+sync_anchor,1)
'''

fixed=src[:start]+replacement+src[end:]
ns={'__name__':'__main__','__file__':str(base)}
exec(compile(fixed,str(base),'exec'),ns,ns)
