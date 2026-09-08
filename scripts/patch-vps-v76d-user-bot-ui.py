from pathlib import Path

base=Path('/opt/wiener-code/scripts/patch-vps-v76-user-bot-ui.py')
if not base.exists():
    raise SystemExit('ERROR: base V76 patch missing in /opt/wiener-code/scripts')

src=base.read_text()
start=src.find("old=\"{command:'start'")
if start<0:
    raise SystemExit('ERROR: brittle V76 command replacement block start not found')
end_marker="s=s.replace(old,new,1)\n"
end=src.find(end_marker,start)
if end<0:
    raise SystemExit('ERROR: brittle V76 command replacement block end not found')
end+=len(end_marker)

replacement="""sync_anchor='async function internalV18('
if sync_anchor not in s:
    raise SystemExit('ERROR: sync wrapper anchor missing')
override=r'''\n// === WIENER USER COMMAND SYNC OVERRIDE V76D ===\nconst syncTelegramV18Base76D=syncTelegramV18;\nsyncTelegramV18=async function(){\n  const info=await syncTelegramV18Base76D();\n  await tgV10('setMyCommands',{commands:[\n    {command:'start',description:'Open WIENER home'},\n    {command:'wallet',description:'Wallet & withdrawals'},\n    {command:'rewards',description:'Reward center'},\n    {command:'network',description:'Referral network'},\n    {command:'progress',description:'Your progress'},\n    {command:'activity',description:'Recent activity'},\n    {command:'status',description:'Account status'},\n    {command:'profile',description:'VIP profile card'},\n    {command:'help',description:'Help & support'}\n  ]});\n  return info;\n};\n// === END WIENER USER COMMAND SYNC OVERRIDE V76D ===\n'''
s=s.replace(sync_anchor,override+'\\n'+sync_anchor,1)
"""

fixed=src[:start]+replacement+src[end:]
ns={'__name__':'__main__','__file__':str(base)}
exec(compile(fixed,str(base),'exec'),ns,ns)
