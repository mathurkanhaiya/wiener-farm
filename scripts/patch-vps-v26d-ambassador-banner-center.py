from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
old="""  // Center the code in the large right-hand ticket panel and make it prominent.
  const cx=Math.round(width*0.585),cy=Math.round(height*0.752);
  const size=Math.max(82,Math.min(110,Math.round(width*0.078*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.028));"""
new="""  // Large, visually centered code inside the right-hand golden ticket panel.
  const cx=Math.round(width*0.590),cy=Math.round(height*0.755);
  const size=Math.max(90,Math.min(118,Math.round(width*0.084*(10/Math.max(10,clean.length)))));
  const stroke=Math.max(2,Math.round(size*0.025));"""

changed=False
if old in s:
    s=s.replace(old,new,1)
    changed=True
elif 'width*0.590' in s and 'width*0.084' in s:
    print('V26D already installed')
    raise SystemExit(0)
else:
    raise SystemExit('ERROR: current Ambassador banner geometry anchor not found')

p.write_text(s)
print('V26D set Ambassador promo code large and centered like target banner')
