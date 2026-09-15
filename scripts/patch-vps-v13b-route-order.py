from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
start='// === WIENER VPS V13 APP PARITY ==='
end='// === END WIENER VPS V13 APP PARITY ==='

if 'WIENER VPS V13B ROUTE ORDER' in s:
    print('V13B route order already installed')
    raise SystemExit(0)

a=s.find(start)
b=s.find(end,a)
if a<0 or b<0:
    raise SystemExit('ERROR: V13 app parity block not found; install V13 first')
b += len(end)
block=s[a:b]
# Remove the misplaced block first.
s=s[:a]+s[b:]

err=s.find('route_not_enabled_yet')
if err<0:
    raise SystemExit('ERROR: route_not_enabled_yet fallback not found')

# Find the Express route/use statement that owns the generic fallback.
line_start=s.rfind('\n',0,err)+1
insert_at=-1
scan=line_start
while scan>0:
    prev=s.rfind('\n',0,scan-1)+1
    line=s[prev:scan].lstrip()
    if line.startswith('app.'):
        insert_at=prev
        break
    scan=prev
if insert_at<0:
    # Fallback: nearest app. token before the error string.
    token=s.rfind('app.',0,err)
    if token<0: raise SystemExit('ERROR: generic fallback route start not found')
    insert_at=s.rfind('\n',0,token)+1

marker='// === WIENER VPS V13B ROUTE ORDER ===\n'
s=s[:insert_at]+marker+block+'\n\n'+s[insert_at:]
p.write_text(s)
print('Moved V13 routes before generic fallback')
