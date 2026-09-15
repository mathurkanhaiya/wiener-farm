from pathlib import Path
import os

p=Path(os.environ.get('WIENER_BACKEND_FILE','/opt/wiener-backend/server.mjs'))
if not p.exists():
    alt=Path('/opt/wiener-backend/server.js')
    if alt.exists(): p=alt

s=p.read_text()
MARK='WIENER AMBASSADOR DIRECT PHOTO UPLOAD V26E'

if MARK in s:
    print('V26E already installed')
    raise SystemExit(0)

anchor='// === END WIENER AMBASSADOR GENERATED BANNERS V26 ==='
if anchor not in s:
    raise SystemExit('ERROR: V26 Ambassador banner system not installed')

helper=r'''
// === WIENER AMBASSADOR DIRECT PHOTO UPLOAD V26E ===
async function sendAmbassadorPhotoV26E(chatId,banner,code,caption,markup){
  const file=pathAmbV26.join(AMB_HOST_DIR_V26,String(banner.asset||''));
  const bytes=await fsAmbV26.readFile(file);
  if(!bytes.length)throw new Error('ambassador_banner_empty');

  const form=new FormData();
  form.append('chat_id',String(chatId));
  form.append('caption',String(caption||''));
  form.append('parse_mode','HTML');
  form.append('reply_markup',JSON.stringify(markup||{}));
  form.append('photo',new Blob([bytes],{type:'image/png'}),String(code||'ambassador-promo')+'.png');

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const rr=await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`,{
      method:'POST',
      body:form,
      signal:controller.signal
    });
    let j={};
    try{j=await rr.json()}catch{}
    if(!rr.ok||!j?.ok)throw new Error('telegram:'+String(j?.description||`HTTP ${rr.status}`));
    return j.result;
  }catch(e){
    if(e?.name==='AbortError')throw new Error('telegram:sendPhoto timeout');
    throw e;
  }finally{
    clearTimeout(timer);
  }
}
// === END WIENER AMBASSADOR DIRECT PHOTO UPLOAD V26E ===
'''
s=s.replace(anchor,helper+'\n'+anchor,1)

old="const msg=await telegramApi('sendPhoto',{chat_id:a.channel_id,photo:banner.url,caption,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'🚀 OPEN WIENER FARM',url:`https://t.me/WienerDogeFarmBot/app?startapp=promo_${made.code}`}]]}});"
new="const markupV26E={inline_keyboard:[[{text:'🚀 OPEN WIENER FARM',url:`https://t.me/WienerDogeFarmBot/app?startapp=promo_${made.code}`}]]};\n        const msg=await sendAmbassadorPhotoV26E(a.channel_id,banner,made.code,caption,markupV26E);"

if old not in s:
    raise SystemExit('ERROR: Ambassador sendPhoto URL anchor not found')
s=s.replace(old,new,1)

p.write_text(s)
print('V26E switched Ambassador publish to direct Telegram photo upload')
