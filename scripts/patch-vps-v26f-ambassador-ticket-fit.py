from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
old="""  // Large, visually centered code inside the right-hand golden ticket panel.
  const cx=Math.round(width*0.590),cy=Math.round(height*0.755);
  const size=Math.max(90,Math.min(118,Math.round(width*0.084*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.025));"""
new="""  // Fit the code fully inside the right-hand golden ticket panel.
  const cx=Math.round(width*0.605),cy=Math.round(height*0.795);
  const size=Math.max(78,Math.min(100,Math.round(width*0.071*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.024));"""

if old in s:
    s=s.replace(old,new,1)
elif 'width*0.605' in s and 'width*0.071' in s and 'height*0.795' in s:
    print('V26F already installed')
    raise SystemExit(0)
else:
    raise SystemExit('ERROR: Ambassador banner geometry anchor not found')

s=s.replace('letter-spacing="3" fill="rgba(50,28,8,.30)"','letter-spacing="2" fill="rgba(50,28,8,.30)"',1)
s=s.replace('letter-spacing="3" fill="#0b542f"','letter-spacing="2" fill="#0b542f"',1)

p.write_text(s)
print('V26F fitted Ambassador promo code fully inside ticket')
