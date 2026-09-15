from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
old="""  const cx=Math.round(width*0.59),cy=Math.round(height*0.758);
  const size=Math.max(58,Math.min(92,Math.round(width*0.057*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.035));"""
new="""  // Center the code in the large right-hand ticket panel and make it prominent.
  const cx=Math.round(width*0.585),cy=Math.round(height*0.752);
  const size=Math.max(82,Math.min(110,Math.round(width*0.078*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.028));"""

changed=False
if old in s:
    s=s.replace(old,new,1)
    changed=True

if 'letter-spacing="2" fill="rgba(50,28,8,.30)"' in s:
    s=s.replace('letter-spacing="2" fill="rgba(50,28,8,.30)"','letter-spacing="3" fill="rgba(50,28,8,.30)"',1)
    changed=True
if 'letter-spacing="2" fill="#0b542f"' in s:
    s=s.replace('letter-spacing="2" fill="#0b542f"','letter-spacing="3" fill="#0b542f"',1)
    changed=True

if changed:
    p.write_text(s)
    print('V26C centered and enlarged Ambassador banner code text')
elif 'width*0.078' in s and 'width*0.585' in s:
    print('V26C already installed')
else:
    raise SystemExit('ERROR: Ambassador banner text renderer anchor not found')
