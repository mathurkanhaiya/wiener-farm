from pathlib import Path

p = Path('/opt/wiener-backend/server.mjs')
s = p.read_text()
marker = "\napp.use((_req,res)=>\n  res.status(404).json({ok:false,error:'route_not_enabled_yet'})\n);\n"

# The old V18 installer only installed the smaller partial layer.  If that layer
# is present without the full V18 layer, remove only that layer and its webhook
# hook so the reviewed full V18 patch can be installed cleanly.
if 'WIENER VPS FULL BOT PARITY V18' in s:
    print('Full V18 bot parity already present; no cleanup needed')
    raise SystemExit(0)

partial = '// === WIENER VPS BOT HANDLER PARITY V18 ==='
if partial not in s:
    print('No partial V18 bot layer present; backend ready')
    raise SystemExit(0)

hook = "    try{if(await handleBotParityV18(up,uid,text,m,q)) return done();}catch(e){console.error('v18_bot_parity',String(e?.message||e));}\n"
if hook in s:
    s = s.replace(hook, '', 1)

start = s.find(partial)
end = s.find(marker, start)
if start < 0 or end < 0:
    raise SystemExit('ERROR: partial V18 boundaries not found; refusing unsafe cleanup')

segment = s[start:end]
# Refuse to delete across a later migration layer.  The partial V18 block itself
# has exactly its own WIENER marker; any other migration marker means manual
# inspection is safer than broad deletion.
other = [line for line in segment.splitlines() if line.strip().startswith('// === WIENER VPS') and partial not in line]
if other:
    raise SystemExit('ERROR: later VPS migration marker found inside partial V18 range; refusing unsafe cleanup: ' + ', '.join(other[:3]))

s = s[:start] + s[end:]
p.write_text(s)
print('Removed obsolete partial V18 bot layer safely')
