from pathlib import Path
import re

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()

repls={
"async function menu18(uid,s=await st18()){":"async function menu18(uid,s=null){if(s==null)s=await st18();",
"async function userView18(uid,key,s=await st18()){":"async function userView18(uid,key,s=null){if(s==null)s=await st18();",
}
changed=0
for old,new in repls.items():
    if old in s:
        s=s.replace(old,new)
        changed+=1

# Refuse to proceed if any async function still contains await in its formal
# parameter list. This catches the whole syntax class rather than one function.
bad=[]
for m in re.finditer(r"async\s+function\s+[A-Za-z0-9_$]+\s*\(([^\n{}]*)\)\s*\{",s):
    if re.search(r"\bawait\b",m.group(1)):
        bad.append(m.group(0)[:180])
if bad:
    raise SystemExit('ERROR: illegal await still present in async function parameters: '+ ' | '.join(bad[:5]))

p.write_text(s)
print(f'V19C await-default syntax repair applied: {changed} replacement(s)')
