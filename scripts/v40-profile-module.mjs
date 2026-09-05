import crypto from 'node:crypto';

let sharp40=null;

export function createProfileSystem({pool,BOT,tg,safe,n,fmt,kb,cb,url,usr}){
  const themes={
    red:{name:'WIENER RED',bg1:'#270208',bg2:'#87071d',panel:'#170307',accent:'#ff3f58',accent2:'#ffabb7',text:'#fff8f9',muted:'#e9a5af'},
    obsidian:{name:'OBSIDIAN',bg1:'#050506',bg2:'#202127',panel:'#050506',accent:'#f0f0f3',accent2:'#aeb2bd',text:'#ffffff',muted:'#b8bbc4'},
    diamond:{name:'DIAMOND',bg1:'#031722',bg2:'#075273',panel:'#041016',accent:'#54e2ff',accent2:'#c9f8ff',text:'#f8feff',muted:'#9eddeb'},
    royal:{name:'ROYAL',bg1:'#170522',bg2:'#651482',panel:'#110318',accent:'#e7a4ff',accent2:'#ffd773',text:'#fff9ff',muted:'#d9afe5'},
    neon:{name:'NEON',bg1:'#031612',bg2:'#07504b',panel:'#02110e',accent:'#25ffd1',accent2:'#a9ffef',text:'#f7fffd',muted:'#96ddcf'}
  };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const cut=(v,m=28)=>{const x=String(v||'');return x.length<=m?x:x.slice(0,m-1)+'…'};
  const member=v=>{try{return new Date(v).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric',timeZone:'UTC'}).toUpperCase()}catch{return '—'}};
  const serial=uid=>'WF-'+String(uid).padStart(10,'0');
  const initials=name=>String(name||'WF').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'WF';

  const vipTiers=[
    {level:0,name:'MEMBER',need:0},
    {level:1,name:'VIP I',need:100},
    {level:2,name:'VIP II',need:350},
    {level:3,name:'VIP III',need:900},
    {level:4,name:'ELITE',need:1800},
    {level:5,name:'LEGEND',need:3500}
  ];

  function vip(d){
    const score=n(d.ads)+n(d.tasks)*3+n(d.valid_refs)*15+n(d.farms)*2+n(d.best_streak)*4;
    let idx=0;
    for(let i=0;i<vipTiers.length;i++)if(score>=vipTiers[i].need)idx=i;
    const t=vipTiers[idx],next=vipTiers[idx+1]||null;
    const progress=next?Math.max(0,Math.min(100,Math.floor(((score-t.need)/(next.need-t.need))*100))):100;
    return {...t,score,next:next?.need||null,nextName:next?.name||null,progress};
  }

  function achievements(d){
    const a=[];
    if(d.vip.level>=5)a.push('LEGEND');
    else if(d.vip.level>=3)a.push(d.vip.name);
    if(d.rank&&d.rank<=10)a.push('TOP 10');
    else if(d.rank&&d.rank<=100)a.push('TOP 100');
    if(d.ads>=1000)a.push('1K ADS');
    else if(d.ads>=500)a.push('500 ADS');
    else if(d.ads>=100)a.push('100 ADS');
    if(d.tasks>=100)a.push('TASK MASTER');
    else if(d.tasks>=25)a.push('TASK PRO');
    if(d.valid_refs>=50)a.push('REF KING');
    else if(d.valid_refs>=10)a.push('REF PRO');
    if(d.best_streak>=30)a.push('30D STREAK');
    else if(d.best_streak>=7)a.push('7D STREAK');
    if(d.weekRank&&d.weekRank<=10)a.push('WEEK TOP 10');
    return [...new Set(a)].slice(0,4);
  }

  async function weekly(uid){
    try{
      const q=await pool.query(`
        with w as (
          select telegram_id,coalesce(sum(case when amount>0 then amount else 0 end),0)::numeric earned
          from public.transactions
          where created_at>=date_trunc('week',now())
          group by telegram_id
        ), me as (
          select coalesce((select earned from w where telegram_id=$1),0)::numeric earned
        )
        select case when (select earned from me)>0
          then 1+(select count(*)::int from w where earned>(select earned from me))
          else null end rank,
          (select earned from me) earned
      `,[uid]);
      return {rank:q.rows[0]?.rank?Number(q.rows[0].rank):null,earned:n(q.rows[0]?.earned)};
    }catch{return {rank:null,earned:0}}
  }

  async function data(uid){
    const u=await usr(uid);if(!u)return null;
    const [taskQ,wk]=await Promise.all([
      pool.query('select count(*)::int c from public.task_completions where telegram_id=$1',[uid]).catch(()=>({rows:[{c:0}]})),
      weekly(uid)
    ]);
    let rank=null;
    try{rank=Number((await pool.query('select 1+count(*)::int r from public.users where coalesce(total_earned,0)>coalesce($1,0)',[n(u.total_earned)])).rows[0]?.r||0)||null}catch{}
    const d={
      uid:Number(uid),
      name:cut([u.first_name,u.last_name].filter(Boolean).join(' ')||u.username||'WIENER User',30),
      username:u.username?('@'+String(u.username).replace(/^@/,'')):'No username',
      balance:n(u.balance),total_earned:n(u.total_earned),ads:n(u.total_ads),tasks:Number(taskQ.rows[0]?.c||0),
      valid_refs:n(u.active_referrals_count),farms:n(u.farm_sessions),
      streak:n(u.daily_streak),best_streak:n(u.best_streak),created_at:u.created_at,rank,
      weekRank:wk.rank,weekEarned:wk.earned
    };
    d.vip=vip(d);d.badges=achievements(d);return d;
  }

  async function pref(uid){
    try{
      const r=(await pool.query(`insert into public.wiener_profile_card_preferences(telegram_id,style,updated_at)
        values($1,'auto',now()) on conflict(telegram_id) do update set telegram_id=excluded.telegram_id returning style`,[uid])).rows[0];
      return String(r?.style||'auto');
    }catch{return 'auto'}
  }

  function autoTheme(d){
    if(d.vip.level>=5)return 'royal';
    if(d.vip.level>=4)return 'neon';
    if(d.vip.level>=3)return 'royal';
    if(d.vip.level>=2)return 'diamond';
    if(d.vip.level>=1)return 'obsidian';
    return 'red';
  }

  async function themeFor(uid,d){
    const saved=await pref(uid);
    const key=saved==='auto'?autoTheme(d):(themes[saved]?saved:'red');
    return {key,saved,theme:themes[key]};
  }

  async function setTheme(uid,key){
    if(key!=='auto'&&!themes[key])throw new Error('invalid_theme');
    await pool.query(`insert into public.wiener_profile_card_preferences(telegram_id,style,updated_at)
      values($1,$2,now()) on conflict(telegram_id) do update set style=excluded.style,updated_at=now()`,[uid,key]);
    return key;
  }

  async function getSharp(){if(!sharp40)sharp40=(await import('sharp')).default;return sharp40}

  async function pfp(uid){
    try{
      const p=await tg('getUserProfilePhotos',{user_id:Number(uid),limit:1});
      const set=p?.photos?.[0];if(!Array.isArray(set)||!set.length)return null;
      const f=await tg('getFile',{file_id:set[set.length-1].file_id});if(!f?.file_path)return null;
      const r=await fetch(`https://api.telegram.org/file/bot${BOT}/${f.file_path}`,{signal:AbortSignal.timeout(8000)});
      if(!r.ok)return null;return Buffer.from(await r.arrayBuffer());
    }catch{return null}
  }

  function badgeSvg(d,s){
    const start=300,y=481;
    if(!d.badges.length)return `<text x="${start}" y="${y+18}" font-size="16" font-weight="800" fill="${s.muted}">KEEP PLAYING TO UNLOCK ACHIEVEMENTS</text>`;
    let x=start;
    return d.badges.map(b=>{
      const w=Math.max(112,Math.min(190,46+b.length*10));
      const out=`<g transform="translate(${x},${y})"><rect width="${w}" height="38" rx="19" fill="rgba(255,255,255,.075)" stroke="${s.accent}" stroke-opacity=".45"/><text x="${w/2}" y="25" text-anchor="middle" font-size="14" font-weight="900" fill="${s.text}">${esc(b)}</text></g>`;
      x+=w+10;return out;
    }).join('');
  }

  function svg(d,w,h,compact,s,themeName,verifyCode=''){
    const avatar=compact?136:188,ax=compact?34:64,ay=compact?48:82,right=compact?190:300;
    const stats=compact
      ?[['ADS',fmt(d.ads,0)],['TASKS',fmt(d.tasks,0)],['REFS',fmt(d.valid_refs,0)]]
      :[['ADS WATCHED',fmt(d.ads,0)],['TASKS',fmt(d.tasks,0)],['VALID REFS',fmt(d.valid_refs,0)],['FARM CLAIMS',fmt(d.farms,0)]];
    const sw=compact?137:210,gap=compact?9:16,sx=compact?32:300,sy=compact?342:538;
    const cards=stats.map((x,i)=>`<g transform="translate(${sx+i*(sw+gap)},${sy})"><rect width="${sw}" height="${compact?96:110}" rx="24" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.10)"/><text x="16" y="${compact?31:36}" font-size="${compact?15:16}" font-weight="800" fill="${s.muted}">${esc(x[0])}</text><text x="16" y="${compact?70:78}" font-size="${compact?29:33}" font-weight="900" fill="${s.text}">${esc(x[1])}</text></g>`).join('');
    const main=compact?`
      <text x="${right}" y="74" font-size="15" font-weight="800" fill="${s.muted}" letter-spacing="2">WIENER FARM</text>
      <text x="${right}" y="114" font-size="28" font-weight="900" fill="${s.text}">${esc(cut(d.name,18))}</text>
      <text x="${right}" y="144" font-size="17" font-weight="700" fill="${s.muted}">${esc(cut(d.username,22))}</text>
      <rect x="${right}" y="167" width="112" height="34" rx="17" fill="${s.accent}"/><text x="${right+56}" y="190" text-anchor="middle" font-size="15" font-weight="900" fill="${s.panel}">${esc(d.vip.name)}</text>
      <text x="${right}" y="250" font-size="14" font-weight="800" fill="${s.muted}">BALANCE</text>
      <text x="${right}" y="298" font-size="39" font-weight="950" fill="${s.text}">${esc(fmt(d.balance,2))}</text>
      <text x="${right}" y="323" font-size="15" font-weight="900" fill="${s.accent2}">WIENER</text>
    `:`
      <text x="${right}" y="90" font-size="18" font-weight="800" fill="${s.muted}" letter-spacing="3">WIENER FARM · VERIFIED MEMBER</text>
      <text x="${w-64}" y="90" text-anchor="end" font-size="15" font-weight="900" fill="${s.accent2}">${esc(themeName)}</text>
      <text x="${right}" y="148" font-size="48" font-weight="950" fill="${s.text}">${esc(d.name)}</text>
      <text x="${right}" y="186" font-size="22" font-weight="750" fill="${s.muted}">${esc(d.username)} · UID ${esc(d.uid)}</text>
      <rect x="${right}" y="214" width="150" height="44" rx="22" fill="${s.accent}"/><text x="${right+75}" y="243" text-anchor="middle" font-size="19" font-weight="950" fill="${s.panel}">${esc(d.vip.name)}</text>
      <text x="${right+174}" y="243" font-size="17" font-weight="850" fill="${s.accent2}">GLOBAL ${esc(d.rank?'#'+d.rank:'UNRANKED')} · WEEK ${esc(d.weekRank?'#'+d.weekRank:'—')}</text>
      <text x="${right}" y="315" font-size="17" font-weight="850" fill="${s.muted}" letter-spacing="2">AVAILABLE BALANCE</text>
      <text x="${right}" y="382" font-size="59" font-weight="950" fill="${s.text}">${esc(fmt(d.balance,2))}</text>
      <text x="${right}" y="416" font-size="21" font-weight="900" fill="${s.accent2}">WIENER</text>
      <text x="${right+570}" y="312" font-size="15" font-weight="850" fill="${s.muted}">${esc(d.vip.nextName?d.vip.name+' → '+d.vip.nextName:'MAX VIP')}</text>
      <rect x="${right+570}" y="330" width="300" height="18" rx="9" fill="rgba(255,255,255,.10)"/>
      <rect x="${right+570}" y="330" width="${Math.max(12,Math.round(300*d.vip.progress/100))}" height="18" rx="9" fill="${s.accent}"/>
      <text x="${right+570}" y="377" font-size="18" font-weight="900" fill="${s.text}">${d.vip.progress}%</text>
      <text x="${right+620}" y="377" font-size="15" font-weight="750" fill="${s.muted}">${esc(d.vip.next?fmt(d.vip.score,0)+' / '+fmt(d.vip.next,0)+' activity':'Highest tier reached')}</text>
      <text x="${right}" y="467" font-size="14" font-weight="900" fill="${s.muted}" letter-spacing="2">ACHIEVEMENTS</text>
      ${badgeSvg(d,s)}
    `;
    const foot=compact
      ?`<text x="32" y="484" font-size="13" font-weight="800" fill="${s.muted}">${esc(serial(d.uid))}</text><text x="${w-32}" y="484" text-anchor="end" font-size="13" font-weight="800" fill="${s.muted}">${esc(d.rank?'#'+d.rank:'UNRANKED')}</text>`
      :`<text x="64" y="704" font-size="15" font-weight="850" fill="${s.muted}">${esc(serial(d.uid))}</text><text x="${w/2}" y="704" text-anchor="middle" font-size="15" font-weight="850" fill="${s.muted}">MEMBER SINCE ${esc(member(d.created_at))} · ${esc(verifyCode)}</text><text x="${w-64}" y="704" text-anchor="end" font-size="15" font-weight="850" fill="${s.muted}">STREAK ${fmt(d.streak,0)}D · BEST ${fmt(d.best_streak,0)}D</text>`;
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${s.bg1}"/><stop offset="1" stop-color="${s.bg2}"/></linearGradient><radialGradient id="shine" cx=".82" cy=".08" r=".92"><stop stop-color="${s.accent}" stop-opacity=".24"/><stop offset="1" stop-color="${s.accent}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" rx="${compact?44:52}" fill="url(#bg)"/><rect x="12" y="12" width="${w-24}" height="${h-24}" rx="${compact?36:44}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="2"/><rect width="${w}" height="${h}" rx="${compact?44:52}" fill="url(#shine)"/><circle cx="${ax+avatar/2}" cy="${ay+avatar/2}" r="${avatar/2}" fill="${s.panel}"/><text x="${ax+avatar/2}" y="${ay+avatar/2+(compact?11:16)}" text-anchor="middle" font-size="${compact?46:64}" font-weight="900" fill="${s.accent2}">${esc(initials(d.name))}</text>${main}${cards}${foot}</svg>`;
  }

  async function render(d,themeInfo,sticker=false,verifyCode=''){
    const sharp=await getSharp(),compact=!!sticker,w=compact?512:1280,h=compact?512:740,size=compact?136:188,ax=compact?34:64,ay=compact?48:82,s=themeInfo.theme;
    const [photo,base]=await Promise.all([pfp(d.uid),sharp(Buffer.from(svg(d,w,h,compact,s,themeInfo.theme.name,verifyCode))).png().toBuffer()]);
    const comps=[];
    if(photo){
      const mask=Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`);
      const av=await sharp(photo).rotate().resize(size,size,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer().catch(()=>null);
      if(av)comps.push({input:av,left:ax,top:ay});
    }
    const ring=Buffer.from(`<svg width="${size+16}" height="${size+16}" xmlns="http://www.w3.org/2000/svg"><circle cx="${(size+16)/2}" cy="${(size+16)/2}" r="${size/2+5}" fill="none" stroke="${s.accent}" stroke-width="${compact?6:8}"/><circle cx="${(size+16)/2}" cy="${(size+16)/2}" r="${size/2+1}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"/></svg>`);
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

  async function progress(chatId){
    const m=await safe('sendMessage',{chat_id:chatId,text:'⏳ Loading Wiener profile…'});
    return m?.message_id||null;
  }
  async function progressEdit(chatId,messageId,text){
    if(!messageId)return;
    await safe('editMessageText',{chat_id:chatId,message_id:messageId,text}).catch?.(()=>null);
  }
  async function progressDone(chatId,messageId){
    if(messageId)await safe('deleteMessage',{chat_id:chatId,message_id:messageId});
  }

  async function issueVerification(targetUid,requesterUid,themeKey){
    const code='VFY-'+crypto.randomBytes(4).toString('hex').toUpperCase();
    await pool.query(`insert into public.wiener_profile_card_verifications(card_code,telegram_id,generated_by,theme,created_at)
      values($1,$2,$3,$4,now())`,[code,targetUid,requesterUid,themeKey]);
    pool.query(`delete from public.wiener_profile_card_verifications where created_at<now()-interval '45 days'`).catch(()=>null);
    return code;
  }

  async function verify(code){
    const clean=String(code||'').trim().toUpperCase();
    if(!/^VFY-[A-F0-9]{8}$/.test(clean))return null;
    try{
      const r=(await pool.query(`select v.*,u.username,u.first_name,u.last_name from public.wiener_profile_card_verifications v
        left join public.users u on u.telegram_id=v.telegram_id where v.card_code=$1 limit 1`,[clean])).rows[0];
      if(!r)return null;
      return {
        code:clean,uid:Number(r.telegram_id),
        name:[r.first_name,r.last_name].filter(Boolean).join(' ')||r.username||'WIENER User',
        username:r.username?('@'+String(r.username).replace(/^@/,'')):null,
        theme:themes[r.theme]?.name||String(r.theme||'AUTO').toUpperCase(),
        created_at:r.created_at
      };
    }catch{return null}
  }

  function buttons(d,requester,verifyCode){
    const own=Number(requester)===Number(d.uid);
    const rows=[
      [cb('🎴 STICKER',`pc39:sticker:${requester}:${d.uid}`),cb('📊 STATS',`pc39:stats:${requester}:${d.uid}`)],
      own?[cb('🎨 THEMES',`pc39:theme:${requester}:${d.uid}`),cb('🔄 REFRESH',`pc39:refresh:${requester}:${d.uid}`)]:[cb('🔄 REFRESH',`pc39:refresh:${requester}:${d.uid}`),cb('✅ VERIFY',`pc39:verify:${requester}:${d.uid}:${verifyCode}`)],
      own?[cb('✅ VERIFY',`pc39:verify:${requester}:${d.uid}:${verifyCode}`),url('🌭 OPEN WIENER FARM','https://t.me/WienerDogeFarmBot/app')]:[url('🌭 OPEN WIENER FARM','https://t.me/WienerDogeFarmBot/app')]
    ];
    return kb(rows);
  }

  async function sendCard(chatId,targetUid,requesterUid=targetUid,showProgress=true){
    const status=showProgress?await progress(chatId):null;
    try{
      await safe('sendChatAction',{chat_id:chatId,action:'upload_photo'});
      const d=await data(targetUid);
      if(!d){
        await progressDone(chatId,status);
        await safe('sendMessage',{chat_id:chatId,text:'🌭 This user does not have a Wiener Farm profile yet.',reply_markup:kb([[url('🌭 OPEN WIENER FARM','https://t.me/WienerDogeFarmBot/app')]])});
        return null;
      }
      await progressEdit(chatId,status,'🎨 Picking the best theme…');await sleep(220);
      const themeInfo=await themeFor(targetUid,d);
      await progressEdit(chatId,status,`⚙️ Generating ${themeInfo.theme.name} VIP card…`);await sleep(220);
      const verifyCode=await issueVerification(targetUid,requesterUid,themeInfo.key);
      const bytes=await render(d,themeInfo,false,verifyCode);
      await progressEdit(chatId,status,'✨ Just finishing…');await sleep(180);
      const caption=`${d.vip.name} · WIENER FARM\n${d.name}${d.username!=='No username'?' · '+d.username:''}\n💰 ${fmt(d.balance,2)} WIENER · 🏆 ${d.rank?'#'+d.rank:'Unranked'} · 📅 Week ${d.weekRank?'#'+d.weekRank:'—'}\n✅ ${verifyCode}`;
      const out=await upload('sendPhoto',chatId,'photo',bytes,'image/png',`wiener-${targetUid}.png`,{caption,reply_markup:buttons(d,requesterUid,verifyCode)});
      await progressDone(chatId,status);return out;
    }catch(e){
      await progressDone(chatId,status);
      console.error('v40_profile_card',String(e?.message||e));
      const d=await data(targetUid).catch(()=>null);
      if(d)await safe('sendMessage',{chat_id:chatId,text:`👑 ${d.vip.name} · WIENER FARM\n\n${d.name}\nUID: ${d.uid}\n💰 ${fmt(d.balance,2)} WIENER\n🏆 ${d.rank?'#'+d.rank:'Unranked'}\n📺 ${fmt(d.ads,0)} Ads · ✅ ${fmt(d.tasks,0)} Tasks · 👥 ${fmt(d.valid_refs,0)} Valid Referrals`});
      else await safe('sendMessage',{chat_id:chatId,text:'⚠️ Could not generate this profile right now.'});
      return null;
    }
  }

  async function sendSticker(chatId,targetUid,requesterUid=targetUid){
    const d=await data(targetUid);if(!d)throw new Error('profile_not_found');
    const themeInfo=await themeFor(targetUid,d);
    const status=await safe('sendMessage',{chat_id:chatId,text:'🎴 Creating profile sticker…'});
    try{
      const out=await upload('sendSticker',chatId,'sticker',await render(d,themeInfo,true),'image/webp',`wiener-${targetUid}.webp`,{reply_markup:kb([[cb('🖼 FULL CARD',`pc39:make:${requesterUid}:${targetUid}`)]])});
      if(status?.message_id)await safe('deleteMessage',{chat_id:chatId,message_id:status.message_id});
      return out;
    }catch(e){
      if(status?.message_id)await safe('deleteMessage',{chat_id:chatId,message_id:status.message_id});
      console.error('v40_profile_sticker',String(e?.message||e));return sendCard(chatId,targetUid,requesterUid,false);
    }
  }

  async function stats(uid,privateChat=false){
    const d=await data(uid);if(!d)return 'Profile not found.';
    return `📊 WIENER PROFILE STATS\n\n${d.name}${d.username!=='No username'?' · '+d.username:''}\nUID: ${d.uid}\n\n👑 VIP: ${d.vip.name}\n⭐ Activity score: ${fmt(d.vip.score,0)}${d.vip.next?'\n📈 '+d.vip.progress+'% to '+d.vip.nextName+' ('+fmt(d.vip.score,0)+'/'+fmt(d.vip.next,0)+')':'\n👑 Highest VIP tier reached'}\n🏆 Global rank: ${d.rank?'#'+d.rank:'Unranked'}\n📅 Weekly rank: ${d.weekRank?'#'+d.weekRank:'Unranked'}\n\n💰 Balance: ${fmt(d.balance,2)} WIENER${privateChat?'\n📈 Total earned: '+fmt(d.total_earned,2)+' WIENER':''}\n📺 Ads watched: ${fmt(d.ads,0)}\n✅ Tasks completed: ${fmt(d.tasks,0)}\n👥 Valid referrals: ${fmt(d.valid_refs,0)}\n🌾 Farm claims: ${fmt(d.farms,0)}\n🔥 Streak: ${fmt(d.streak,0)} · Best ${fmt(d.best_streak,0)}\n\n🏅 Achievements: ${d.badges.length?d.badges.join(' · '):'Keep progressing to unlock badges'}\n🪪 ${serial(d.uid)}\n📅 Member since ${member(d.created_at)}`;
  }

  async function themeMenu(chatId,uid,q=null){
    const d=await data(uid);if(!d){await safe('sendMessage',{chat_id:chatId,text:'Profile not found.'});return}
    const saved=await pref(uid),chosen=saved==='auto'?autoTheme(d):saved;
    const label=k=>(saved===k?'✅ ':'')+(k==='auto'?'AUTO · BEST MATCH':themes[k].name);
    const markup=kb([
      [cb(label('auto'),`pc39:set:${uid}:auto`)],
      [cb(label('red'),`pc39:set:${uid}:red`),cb(label('obsidian'),`pc39:set:${uid}:obsidian`)],
      [cb(label('diamond'),`pc39:set:${uid}:diamond`),cb(label('royal'),`pc39:set:${uid}:royal`)],
      [cb(label('neon'),`pc39:set:${uid}:neon`)],
      [cb('🖼 GENERATE CARD',`pc39:make:${uid}:${uid}`)]
    ]);
    const text=`🎨 WIENER CARD THEMES\n\nCurrent: ${themes[chosen]?.name||'WIENER RED'}${saved==='auto'?' · Auto selected':''}\n\nAUTO picks a premium theme based on your VIP level. Choose any theme below.`;
    if(q?.message?.message_id)await safe('editMessageText',{chat_id:chatId,message_id:q.message.message_id,text,reply_markup:markup});
    else await safe('sendMessage',{chat_id:chatId,text,reply_markup:markup});
  }

  async function resolveTarget(m,requesterUid,arg=''){
    const reply=m?.reply_to_message?.from;
    if(reply?.id&&!reply?.is_bot)return Number(reply.id);
    const raw=String(arg||'').trim();
    if(/^\d{5,20}$/.test(raw))return Number(raw);
    if(raw){
      const name=raw.replace(/^@/,'').toLowerCase();
      if(/^[a-z0-9_]{3,32}$/.test(name)){
        try{
          const r=(await pool.query('select telegram_id from public.users where lower(username)=$1 limit 1',[name])).rows[0];
          if(r?.telegram_id)return Number(r.telegram_id);
        }catch{}
      }
    }
    return Number(requesterUid);
  }

  async function verifyMessage(chatId,code){
    const v=await verify(code);
    if(!v){await safe('sendMessage',{chat_id:chatId,text:'❌ Card verification failed. The code is invalid or no longer available.'});return}
    await safe('sendMessage',{chat_id:chatId,text:`✅ VERIFIED WIENER CARD\n\n👤 ${v.name}${v.username?' · '+v.username:''}\n🆔 UID: ${v.uid}\n🎨 Theme: ${v.theme}\n🔐 Code: ${v.code}\n🕒 Generated: ${new Date(v.created_at).toISOString().replace('T',' ').slice(0,16)} UTC\n\n🌭 Authentic Wiener Farm profile card.`});
  }

  async function handle(q){
    if(!q||!String(q.data||'').startsWith('pc39:'))return false;
    const p=String(q.data).split(':'),act=p[1],clicker=Number(q.from?.id||0);
    let requester=Number(p[2]||clicker),target=Number(p[3]||p[2]||clicker);
    if(!p[2])requester=target=clicker;
    if(requester!==clicker){await safe('answerCallbackQuery',{callback_query_id:q.id,text:'This control belongs to another user.',show_alert:true});return true}
    const chatId=q.message?.chat?.id||clicker;
    try{
      if(act==='make'||act==='refresh'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:act==='make'?'Generating VIP card…':'Refreshing profile…'});
        const m=await sendCard(chatId,target,requester,true);
        if(m?.message_id&&q.message?.message_id&&act==='refresh')await safe('deleteMessage',{chat_id:chatId,message_id:q.message.message_id});
      }else if(act==='sticker'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Creating sticker…'});await sendSticker(chatId,target,requester);
      }else if(act==='stats'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Stats opened'});
        await safe('sendMessage',{chat_id:chatId,text:await stats(target,q.message?.chat?.type==='private'&&target===requester)});
      }else if(act==='theme'){
        if(target!==requester)throw new Error('only_owner_can_change_theme');
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Choose your theme'});await themeMenu(chatId,requester,q);
      }else if(act==='set'){
        const key=String(p[3]||'auto');await setTheme(requester,key);
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:key==='auto'?'Auto theme enabled':themes[key]?.name+' selected'});await themeMenu(chatId,requester,q);
      }else if(act==='verify'){
        await safe('answerCallbackQuery',{callback_query_id:q.id,text:'Verifying card…'});await verifyMessage(chatId,String(p[4]||''));
      }else return false;
    }catch(e){await safe('answerCallbackQuery',{callback_query_id:q.id,text:String(e?.message||e).replace(/_/g,' ').slice(0,180),show_alert:true})}
    return true;
  }

  return{sendCard,sendSticker,stats,handle,themeMenu,resolveTarget,verifyMessage};
}
