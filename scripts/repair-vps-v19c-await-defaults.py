from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

# Known safe syntax repairs in the reviewed V18/V19 bot parity layer.
repls={
"async function menu18(uid,s=await st18()){":"async function menu18(uid,s=null){if(s==null)s=await st18();",
"async function userView18(uid,key,s=await st18()){":"async function userView18(uid,key,s=null){if(s==null)s=await st18();",
"const map={010:.10,025:.25,050:.50}":"const map={'010':.10,'025':.25,'050':.50}",
}
changed=0
for old,new in repls.items():
    if old in s:
        s=s.replace(old,new)
        changed+=1

# Refuse to proceed if any async function still contains await in its formal
# parameter list. This catches the whole await-default syntax class.
bad=[]
for m in re.finditer(r"async\s+function\s+[A-Za-z0-9_$]+\s*\(([^\n{}]*)\)\s*\{",s):
    if re.search(r"\bawait\b",m.group(1)):
        bad.append(m.group(0)[:180])
if bad:
    raise SystemExit('ERROR: illegal await still present in async function parameters: '+ ' | '.join(bad[:5]))

# The full backend is an ES module (strict mode), so unquoted legacy octal
# object keys are illegal. The V18 payout preset map used 010/025/050; the
# explicit repair above preserves those callback keys as strings.
legacy=[]
for m in re.finditer(r"(?<![A-Za-z0-9_$'\".])0[0-9]+\s*:",s):
    legacy.append(m.group(0).strip())
if legacy:
    raise SystemExit('ERROR: unquoted leading-zero numeric object key remains: '+', '.join(legacy[:10]))

p.write_text(s)
print(f'V19C syntax repair applied: {changed} replacement(s)')
