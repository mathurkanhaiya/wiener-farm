from pathlib import Path
import re

p = Path('/opt/wiener-backend/server.mjs')
s = p.read_text()
TAG = 'WIENER SPONSORED FIXED REWARD V38'

if TAG in s:
    print('V38 fixed sponsored reward already installed')
    raise SystemExit(0)

for need in ['WIENER SPONSORED TASK MANAGER V30','WIENER ADDTASK V35B','async function showAddtask18','/functions/v1/wiener-sponsored-task']:
    if need not in s:
        raise SystemExit('ERROR: required backend feature missing: ' + need)

# Server-authoritative reward: ignore any client-supplied WIENER amount.
old = "reward=Number(b.reward||0)"
if old not in s:
    raise SystemExit('ERROR: sponsored reward parser not found')
s = s.replace(old, "reward=10", 1)

# Preset completion buttons now skip reward selection and go straight to review.
old = "{target_completions:n18(z),step:'reward'}"
if old not in s:
    raise SystemExit('ERROR: addtask preset completion handler not found')
s = s.replace(old, "{target_completions:n18(z),reward_per_completion:10,step:'review'}", 1)

# Custom completion input also skips reward selection.
old = "await showAddtask18(await setAddtask18(uid,{target_completions:c,step:'reward'}));return true"
if old not in s:
    raise SystemExit('ERROR: addtask custom completion handler not found')
s = s.replace(old, "await showAddtask18(await setAddtask18(uid,{target_completions:c,reward_per_completion:10,step:'review'}));return true", 1)

# Any stale old reward button is harmless and still resolves to the fixed reward.
pat = r"else if\(d\.startsWith\('at:r:'\)\)\{.*?\}else if\(d==='at:pay'\)"
m = re.search(pat, s, re.S)
if not m:
    raise SystemExit('ERROR: addtask reward callback block not found')
fixed = "else if(d.startsWith('at:r:')){s=await setAddtask18(uid,{reward_per_completion:10,step:'review'});await showAddtask18(s)}else if(d==='at:pay')"
s = s[:m.start()] + fixed + s[m.end():]

# Remove the reward-choice page itself. Legacy sessions on that step auto-advance.
pat = r"\s*if\(s\.step==='reward'\)return edit\(`🎁 Reward per completion.*?\);"
m = re.search(pat, s, re.S)
if not m:
    raise SystemExit('ERROR: reward selection screen not found')
replacement = "\n  if(s.step==='reward'){s=await setAddtask18(s.telegram_id,{reward_per_completion:10,step:'review'})}"
s = s[:m.start()] + replacement + s[m.end():]

# Ensure the payment request always submits 10 even if an old session contains another value.
old = "reward:s.reward_per_completion"
if old in s:
    s = s.replace(old, "reward:10", 1)

# Add an explicit fixed-reward note to the review screen.
old = "🎁 ${s.reward_per_completion} WIENER each"
if old in s:
    s = s.replace(old, "🎁 10 WIENER each · fixed", 1)

s = s.replace(
    '// === WIENER ADDTASK V35B ===',
    '// === WIENER ADDTASK V35B ===\n// === WIENER SPONSORED FIXED REWARD V38 ===',
    1
)

p.write_text(s)
print('V38 installed: sponsored task reward fixed at 10 WIENER; other reward choices removed')
