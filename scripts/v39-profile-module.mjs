let sharp39=null;

export function createProfileSystem({pool,BOT,tg,safe,n,fmt,kb,cb,url,usr}){
  const style={bg1:'#34040a',bg2:'#7d0718',panel:'#1d0509',accent:'#ff4058',accent2:'#ffb0bb',text:'#fff7f8',muted:'#e7a8b1'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const cut=(v,m=28)=>{const x=String(v||'');return x.length<=m?x:x.slice(0,m-1)+'…'};
  const member=v=>{try{return new Date(v).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric',timeZone:'UTC'}).toUpperCase()}catch{return '—'}};
  const serial=uid=>'WF-'+String(uid).padStart(10,'0');
  const initials=name=>String(name||'WF').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'WF';

  function vip(d){
    const score=n(d.ads)+n(d.tasks)*3+n(d.valid_refs)*15+n(d.farms)*2+n(d.best_streak)*4;
    const tiers=[
      {level:5,name:'LEGEND',need:3500},
      {level:4,name:'ELITE',need:1800},
      {level:3,name:'VIP III',need:900},
      {level:2,name:'VIP II',need:350},
      {level:1,name:'VIP I',need:100},
      {level:0,name:'MEMBER',need:0}
    ];
    const t=tiers.find(x=>score>=x.need)||tiers[tiers.length-1];
    return {...t,score,next:[100,350,900,1800,3500].find(x=>x>score)||null};
  }

  async function data(uid){
    const u=await usr(uid);if(!u)return null;
    const tasks=Number((await pool.query('select count(*)::int c from public.task_completions where telegram_id=$1',[uid])).rows[0]?.c||0);
    let rank=null;
    try{rank=Number((await pool.query('select 1+count(*)::int r from public.users where coalesce(total_earned,0)>coalesce($1,0)',[n(u.total_earned)])).rows[0]?.r||0)||null}catch{}
    const d={
      uid:Number(uid),
      name:cut([u.first_name,u.last_name].filter(Boolean).join(' ')||u.username||'WIENER User',30),
      username:u.username?('@'+String(u.username).replace(/^@/,'')):'No username',
      balance:n(u.balance),total_earned:n(u.total_earned),ads:n(u.total_ads),tasks,
      valid_refs:n(u.active_referrals_count),farms:n(u.farm_sessions),
      streak:n(u.daily_streak),best_streak:n(u.best_streak),created_at:u.created_at,rank
    };
    d.vip=vip(d);return d;
  }

  async function getSharp(){if(!sharp39)sharp39=(await import('sharp')).default;return sharp39}

  async function pfp(uid){
    try{
      const p=await tg('getUserProfilePhotos',{user_id:Number(uid),limit:1});
      const set=p?.photos?.[0];if(!Array.isArray(set)||!set.length)return null;
      const f=await tg('getFile',{file_id:set[set.length-1].file_id});if(!f?.file_path)return null;
      const r=await fetch(`https://api.telegram.org/file/bot${BOT}/${f.file_path}`,{signal:AbortSignal.timeout(8000)});
      if(!r.ok)return null;return Buffer.from(await r.arrayBuffer());
    }catch{return null}
  }

  function svg(d,w,h,compact){
    const s=style,avatar=compact?136:188,ax=compact?34:64,ay=compact?48:82,right=compact?190:300;
    const stats=compact
      ?[['ADS',fmt(d.ads,0)],['TASKS',fmt(d.tasks,0)],['REFS',fmt(d.valid_refs,0)]]
      :[['ADS WATCHED',fmt(d.ads,0)],['TASKS',fmt(d.tasks,0)],['VALID REFS',fmt(d.valid_refs,0)],['FARM CLAIMS',fmt(d.farms,0)]];
    const sw=compact?137:210,gap=compact?9:16,sx=compact?32:64,sy=compact?342:490;
    const cards=stats.map((x,i)=>`<g transform="translate(${sx+i*(sw+gap)},${sy})"><rect width="${sw}" height="${compact?96:120}" rx="24" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.09)"/><text x="16" y="${compact?31:39}" font-size="${compact?15:18}" font-weight="800" fill="${s.muted}">${esc(x[0])}</text><text x="16" y="${compact?70:86}" font-size="${compact?29:36}" font-weight="900" fill="${s.text}">${esc(x[1])}</text></g>`).join('');
    const main=compact?`
      <text x="${right}" y="74" font-size="15" font-weight="800" fill="${s.muted}" letter-spacing="2">WIENER FARM</text>
      <text x="${right}" y="114" font-size="28" font-weight="900" fill="${s.text}">${esc(cut(d.name,18))}</text>
      <text x="${right}" y="144" font-size="17" font-weight="700" fill="${s.muted}">${esc(cut(d.username,22))}</text>
      <rect x="${right}" y="167" width="112" height="34" rx="17" fill="${s.accent}"/><text x="${right+56}" y="190" text-anchor="middle" font-size="15" font-weight="900" fill="#160409">${esc(d.vip.name)}</text>
      <text x="${right}" y="250" font-size="14" font-weight="800" fill="${s.muted}">BALANCE</text>
      <text x="${right}" y="298" font-size="39" font-weight="950" fill="${s.text}">${esc(fmt(d.balance,2))}</text>
      <text x="${right}" y="323" font-size="15" font-weight="900" fill="${s.accent2}">WIENER</text>
    `:`
      <text x="${right}" y="98" font-size="20" font-weight="800" fill="${s.muted}" letter-spacing="3">WIENER FARM · VIP MEMBER CARD</text>
      <text x="${right}" y="156" font-size="50" font-weight="950" fill="${s.text}">${esc(d.name)}</text>
      <text x="${right}" y="195" font-size="23" font-weight="750" fill="${s.muted}">${esc(d.username)}</text>
      <rect x="${right}" y="224" width="150" height="44" rx="22" fill="${s.accent}"/><text x="${right+75}" y="253" text-anchor="middle" font-size="19" font-weight="950" fill="#160409">${esc(d.vip.name)}</text>
      <text x="${right+170}" y="253" font-size="18" font-weight="800" fill="${s.accent2}">GLOBAL ${esc(d.rank?'#'+d.rank:'UNRANKED')}</text>
      <text x="${right}" y="330" font-size="18" font-weight="850" fill="${s.muted}" letter-spacing="2">AVAILABLE BALANCE</text>
      <text x="${right}" y="399" font-size="62" font-weight="950" fill="${s.text}">${esc(fmt(d.balance,2))}</text>
      <text x="${right}" y="433" font-size="22" font-weight="900" fill="${s.accent2}">WIENER</text>
    `;
    const foot=compact
      ?`<text x="32" y="484" font-size="13" font-weight="800" fill="${s.muted}">${esc(serial(d.uid))}</text><text x="${w-32}" y="484" text-anchor="end" font-size="13" font-weight="800" fill="${s.muted}">${esc(d.rank?'#'+d.rank:'UNRANKED')}</text>`
      :`<text x="64" y="665" font-size="16" font-weight="850" fill="${s.muted}">${esc(serial(d.uid))}</text><text x="${w/2}" y="665" text-anchor="middle" font-size="16" font-weight="850" fill="${s.muted}">MEMBER SINCE ${esc(member(d.created_at))}</text><text x="${w-64}" y="665" text-anchor="end" font-size="16" font-weight="850" fill="${s.muted}">STREAK ${fmt(d.streak,0)}D · BEST ${fmt(d.best_streak,0)}D</text>`;
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${s.bg1}"/><stop offset="1" stop-color="${s.bg2}"/></linearGradient><radialGradient id="shine" cx=".8" cy=".1" r=".9"><stop stop-color="${s.accent}" stop-opacity=".23"/><stop offset="1" stop-color="${s.accent}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" rx="${compact?44:52}" fill="url(#bg)"/><rect x="12" y="12" width="${w-24}" height="${h-24}" rx="${compact?36:44}" fill="none" stroke="rgba(255,255,255,.13)" stroke-width="2"/><rect width="${w}" height="${h}" rx="${compact?44:52}" fill="url(#shine)"/><circle cx="${ax+avatar/2}" cy="${ay+avatar/2}" r="${avatar/2}" fill="${s.panel}"/><text x="${ax+avatar/2}" y="${ay+avatar/2+(compact?11:16)}" text-anchor="middle" font-size="${compact?46:64}" font-weight="900" fill="${s.accent2}">${esc(initials(d.name))}</text>${main}${cards}${foot}</svg>`;
  }

  async function render(d,sticker=false){
    const sharp=await getSharp(),compact=!!sticker,w=compact?512:1280,h=compact?512:720,size=compact?136:188,ax=compact?34:64,ay=compact?48:82;
    const [photo,base]=await Promise.all([pfp(d.uid),sharp(Buffer.from(svg(d,w,h,compact))).png().toBuffer()]);
    const comps=[];
    if(photo){
      const mask=Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`);
      const av=await sharp(photo).rotate().resize(size,size,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer().catch(()=>null);
      if(av)comps.push({input:av,left:ax,top:ay});
    }
    const ring=Buffer.from(`<svg width="${size+16}" height="${size+16}" xmlns="http://www.w3.org/2000/svg"><circle cx="${(size+16)/2}" cy="${(size+16)/2}" r="${size/2+5}" fill="none" stroke="${style.accent}" stroke-width="${compact?6:8}"/><circle cx="${(size+16)/2}" cy="${(size+16)/2}" r="${size/2+1}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"/></svg>`);
    comps.push({input:ring,left:ax-8,top:ay-8});
    const out=sharp(base).composite(comps);
    return sticker?out.webp({quality:82,effort:4}).toBuffer():out.png({compressionLevel:8}).toBuffer();
  }

  async function upload(method,chatId,field,bytes,mime,name,extra={}){
    const form=new FormData();form.append('chat_id',String(chatId));
    for(const [k,v] of Object.entries(extra)){if(v!==undefined&&v!==null)form.append(k,typeof v==='string'?v:JSON.stringify(v))}
    form.append(field,new Blob([bytes],{type:mime}),name);
    const r=await fetch(`https://api.telegram.org/bot${BOT}/${method}`,{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
    const j=await r.json().catch(()=>({ok:false,description:'invalid_response'}));if(!r.ok||!j?.ok)throw new Error(String(j?.description||r.status));return j.result;
  }

  const buttons=d=>kb([[cb('🎴 STICKER',`pc39:sticker:${d.uid}`),cb('📊 STATS',`pc39:stats:${d.uid}`)],[cb('🔄 REFRESH',`pc39:refresh:${d.uid}`)],[url('🌭 OPEN WIENER FARM','https://t.me/WienerDogeFarmBot/app')]]);

  async function sendCard(chatId,uid){
    const d=await data(uid);
    if(!d){await safe('sendMessage',{chat_id:chatId,text:'🌭 Open WIENER Farm first to create your account.',reply_markup:kb([[url('🌭 OPEN WIENER FARM','https://t.me/WienerDogeFarmBot/app')]])});return null}
    try{
      const bytes=await render(d,false);
      const caption=`${d.vip.name} · WIENER FARM\n${d.name}${d.username!=='No username'?' · '+d.username:''}\n💰 ${fmt(d.balance,2)} WIENER · 🏆 ${d.rank?'#'+d.rank:'Unranked'}`;
      return upload('sendPhoto',chatId,'photo',bytes,'image/png',`wiener-${uid}.png`,{caption,reply_markup:buttons(d)});
    }catch(e){
      console.error('v39_profile_card',String(e?.message||e));
      await safe('sendMessage',{chat_id:chatId,text:`👑 ${d.vip.name} · WIENER FARM\n\n${d.name}\nUID: ${d.uid}\n💰 ${fmt(d.balance,2)} WIENER\n🏆 ${d.rank?'#'+d.rank:'Unranked'}\n📺 ${fmt(d.ads,0)} Ads · ✅ ${fmt(d.tasks,0)} Tasks · 👥 ${fmt(d.valid_refs,0)} Valid Referrals`});
      return null;
    }
  }

  async function sendSticker(chatId,uid){
    const d=await data(uid);if(!d)throw new Error('profile_not_found');
    try{return upload('sendSticker',chatId,'sticker',await render(d,true),'image/webp',`wiener-${uid}.webp`,{reply_markup:kb([[cb('🖼 FULL CARD',`pc39:make:${uid}`)]])})}
    catch(e){console.error('v39_profile_sticker',String(e?.message||e));return sendCard(chatId,uid)}
  }

  async function stats(uid,privateChat=false){
    const d=await data(uid);if(!d)return 'Profile not found.';
    return `📊 WIENER PROFILE STATS\n\n${d.name}${d.username!=='No username'?' · '+d.username:''}\nUID: ${d.uid}\n\n👑 VIP: ${d.vip.name}\n⭐ Activity score: ${fmt(d.vip.score,0)}${d.vip.next?'\n⬆️ Next VIP: '+fmt(d.vip.next,0)+' points':'\n👑 Highest VIP tier reached'}\n🏆 Global rank: ${d.rank?'#'+d.rank:'Unranked'}\n\n💰 Balance: ${fmt(d.balance,2)} WIENER${privateChat?'\n📈 Total earned: '+fmt(d.total_earned,2)+' WIENER':''}\n📺 Ads watched: ${fmt(d.ads,0)}\n✅ Tasks completed: ${fmt(d.tasks,0)}\n👥 Valid referrals: ${fmt(d.valid_refs,0)}\n🌾 Farm claims: ${fmt(d.farms,0)}\n🔥 Streak: ${fmt(d.streak,0)} · Best ${fmt(d.best_streak,0)}\n\n🪪 ${serial(d.uid)}\n📅 Member since ${member(d.created_at)}`;
  }

  async function handle(q){
    if(!q||!String(q.data||'').startsWith('pc39:'))return false;
    const p=String(q.data).split(':'),act=p[1],owner=Number(p[2]||q.from?.id||0),uid=Number(q.from?.id||0);
    if(owner&&owner!==uid){await safe('answerCallbackQuery',{callback_query_id:q.id,text:'This card belongs to another user.',show_alert:true});return true}
    const chatId=q.message?.chat?.id||uid;
    try{
      if(act==='make'||act==='refresh'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:act==='make'?'Generating VIP card…':'Refreshing…'});
        const m=await sendCard(chatId,uid);if(m?.message_id&&q.message?.message_id)await safe('deleteMessage',{chat_id:chatId,message_id:q.message.message_id});
      }else if(act==='sticker'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Creating sticker…'});await sendSticker(chatId,uid);
      }else if(act==='stats'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Stats opened'});
        await safe('sendMessage',{chat_id:chatId,text:await stats(uid,q.message?.chat?.type==='private')});
      }else return false;
    }catch(e){await safe('answerCallbackQuery',{callback_query_id:q.id,text:String(e?.message||e).replace(/_/g,' ').slice(0,180),show_alert:true})}
    return true;
  }

  return{sendCard,sendSticker,stats,handle};
}
