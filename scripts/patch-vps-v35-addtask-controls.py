from pathlib import Path

p=Path('/opt/wiener-backend/server.mjs')
s=p.read_text()
TAG='WIENER ADDTASK CONTROLS V35'
if TAG in s:
    print('V35 addtask controls already installed')
    raise SystemExit(0)
if 'WIENER SPONSORED TASK MANAGER V30' not in s:
    raise SystemExit('ERROR: V30 sponsored task manager is required')


def replace_function(src,name,new):
    start=src.find('async function '+name+'(')
    if start<0:
        raise SystemExit('ERROR: function not found: '+name)
    brace=src.find('{',start)
    if brace<0:
        raise SystemExit('ERROR: opening brace not found: '+name)
    depth=0;i=brace;quote=None;esc=False;template=False
    while i<len(src):
        c=src[i]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
        elif template:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=='`': template=False
        else:
            if c in "'\"": quote=c
            elif c=='`': template=True
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    return src[:start]+new+src[i+1:]
        i+=1
    raise SystemExit('ERROR: closing brace not found: '+name)

home=r'''async function sponsorBotHomeV30(uid){
  const d=await sponsorManagerDataV30(uid),active=(d.orders||[]).filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false).length,paused=(d.orders||[]).filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false).length;
  return{text:`ğŸ“£ TASK STUDIO\n\nCreate and manage sponsored tasks from one clean dashboard.\n\nğŸŸ¢ Live: ${active}\nâ¸ Paused: ${paused}\nğŸŸ¡ Awaiting payment: ${d.counts.pending}\nâœ… Completed: ${d.counts.completed}\n\nğŸ’µ 100 completions = $0.30\nğŸ’ TON payment Â· automatic detection`,markup:kb18([[cb18('ï¼‹ CREATE TASK','stm30:new')],[cb18(`ğŸŸ¢ LIVE ${active}`,'stm30:list:live'),cb18(`â¸ PAUSED ${paused}`,'stm30:list:paused')],[cb18(`ğŸŸ¡ PAYMENTS ${d.counts.pending}`,'stm30:list:pending'),cb18(`âœ… DONE ${d.counts.completed}`,'stm30:list:done')],[cb18('ğŸ“š ALL MY TASKS','stm30:list:all')]])};
}'''

listing=r'''async function sponsorBotListV30(uid,mode='all'){
  const d=await sponsorManagerDataV30(uid);let rows=d.orders;
  if(mode==='pending')rows=rows.filter(x=>x.status==='awaiting_payment');
  else if(mode==='live')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false);
  else if(mode==='paused')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false);
  else if(mode==='done')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)<=0);
  rows=rows.slice(0,10);
  const title=mode==='pending'?'AWAITING PAYMENT':mode==='live'?'LIVE TASKS':mode==='paused'?'PAUSED TASKS':mode==='done'?'COMPLETED TASKS':'ALL MY TASKS';
  const body=rows.map((x,i)=>{const max=sponsorNumV30(x.max_completions||x.target_completions),done=sponsorNumV30(x.completed_count),left=Math.max(0,max-done),icon=x.status==='awaiting_payment'?'ğŸŸ¡':left<=0?'âœ…':x.task_enabled===false?'â¸':'ğŸŸ¢';return `${i+1}. ${icon} ${String(x.title||'Task').slice(0,32)}\n   ${done}/${max} done Â· ${left} left Â· +${sponsorNumV30(x.reward_per_completion)} WIENER`}).join('\n\n')||'No tasks here yet.';
  return{text:`ğŸ“š ${title}\n\n${body}`,markup:kb18([...rows.map(x=>[cb18(`${x.status==='awaiting_payment'?'ğŸ’³':'âš™ï¸'} ${String(x.title||'Task').slice(0,28)}`,`stm30:show:${x.id}`)]),[cb18('ï¼‹ CREATE TASK','stm30:new')],[cb18('â—€ï¸ TASK STUDIO','stm30:home')]])};
}'''

show=r'''async function sponsorBotShowV30(uid,id){
  const o=await sponsorOrderV30(uid,id);if(!o)return{text:'Task not found.',markup:kb18([[cb18('â—€ï¸ TASK STUDIO','stm30:home')]])};
  const max=sponsorNumV30(o.max_completions||o.target_completions),done=sponsorNumV30(o.completed_count),remaining=Math.max(0,max-done),pct=max?Math.floor(done/max*100):0;
  if(o.status==='awaiting_payment')return{text:`ğŸŸ¡ PAYMENT REQUIRED\n\n${o.title}\n\nğŸ‘¥ ${o.target_completions} completions\nğŸ +${o.reward_per_completion} WIENER each\nğŸ’µ $${(sponsorNumV30(o.target_completions)/100*.30).toFixed(2)}\n\nğŸ’ SEND: ${sponsorNumV30(o.package_ton).toFixed(6)} TON\nğŸ¦ TO: ${o.payment_address}\nğŸ“ MEMO: ${o.payment_memo}\n\nSend the exact amount with the exact memo, then tap CHECK PAYMENT.`,markup:kb18([[cb18('âœ… CHECK PAYMENT',`stm30:check:${o.id}`)],[cb18('â—€ï¸ MY TASKS','stm30:list:all'),cb18('ğŸ  STUDIO','stm30:home')]])};
  const status=remaining<=0?'âœ… COMPLETED':o.task_enabled===false?'â¸ PAUSED':'ğŸŸ¢ LIVE';
  const rows=[];if(remaining>0)rows.push([cb18(o.task_enabled===false?'â–¶ï¸ RESUME':'â¸ PAUSE',`stm30:toggle:${o.id}:${o.task_enabled===false?'1':'0'}`),cb18('ğŸ”„ REFRESH',`stm30:show:${o.id}`)]);
  rows.push([cb18('ï¼‹100 Â· $0.30','stm30:add:'+o.id+':100'),cb18('ï¼‹250 Â· $0.75','stm30:add:'+o.id+':250')]);rows.push([cb18('ï¼‹500 Â· $1.50','stm30:add:'+o.id+':500'),cb18('ï¼‹1000 Â· $3.00','stm30:add:'+o.id+':1000')]);rows.push([cb18('â—€ï¸ MY TASKS','stm30:list:all'),cb18('ğŸ  STU%<œ°ÍÑ´ÌÀé¡½µ”œ¥ut¤ì(€É•ÑÕÉ¹íÑ•áĞé€‘íÍÑ…ÑÕÍôƒ
ÜQM-q¹q¸‘í¼¹Ñ¥Ñ±•õq¹q»Â~N(€‘í‘½¹•ô¼‘íµ…áô½µÁ±•Ñ•ƒ
Ü€‘íÁÑô•q»Â~:¼€‘íÉ•µ…¥¹¥¹ôÉ•µ…¥¹¥¹q»Â~:€¬‘í¼¹É•İ…É‘}Á•É}½µÁ±•Ñ¥½¹ô]%9H€¼½µÁ±•Ñ¥½¹q»Â~R\€‘í¼¹Ñ…É•Ñ}ÕÉ±ñğŸŠPõq¹q¸‘íÉ•µ…¥¹¥¹œğôÀü…Á…¥Ñä½µÁ±•Ñ•¸‘µ½É”½µÁ±•Ñ¥½¹ÌÑ¼ÉÕ¸¥Ğ……¥¸¸œé¼¹Ñ…Í­}•¹…‰±•ôôõ™…±Í”üQ…Í¬¥ÌÁ…ÕÍ•¸I•ÍÕµ”¥Ğ…¹åÑ¥µ”¸œèQ…Í¬¥Ì…Ñ¥Ù”¥¸=™™¥¥…°Q…Í­Ì¸õ€±µ…É­ÕÀé­ˆÄà¡É½İÌ¥ôì)ôœœœ()ÌõÉ•Á±…•}™Õ¹Ñ¥½¸¡Ì°ÍÁ½¹Í½É	½Ñ!½µ•XÌÀœ±¡½µ”¤)ÌõÉ•Á±…•}™Õ¹Ñ¥½¸¡Ì°ÍÁ½¹Í½É	½Ñ1¥ÍÑXÌÀœ±±¥ÍÑ¥¹œ¤)ÌõÉ•Á±…•}™Õ¹Ñ¥½¸¡Ì°ÍÁ½¹Í½É	½ÑM¡½İXÌÀœ±Í¡½Ü¤)½±ô‰•±Í”¥˜¡…Ğôôô¹•Üœ¥í…İ…¥ĞÍ…™•QœÄà …¹Íİ•É…±±‰…­EÕ•Éäœ±í…±±‰…­}ÅÕ•Éå}¥éÄ¹¥±Ñ•áĞèMÑ…ÉÑ¥¹œÑ…Í¬É•…Ñ½Èô¤í…İ…¥ĞÍÑ…ÉÑ‘‘Ñ…Í¬Äà¡Õ¥¤íÉ•ÑÕÉ¸ÑÉÕ•ôˆ)¹•Üô‰•±Í”¥˜¡…Ğôôô¹•Üœ¥í…İ…¥Ğ±•…É‘‘Ñ…Í¬Äà¡Õ¥¤í…İ…¥ĞÁ½½°¹ÅÕ•Éä¡¥¹Í•ÉĞ¥¹Ñ¼ÁÕ‰±¥Œ¹Ñ…Í­}…‘Ù•ÉÑ¥Í•É}Í•ÍÍ¥½¹Ì¡Ñ•±•É…µ}¥±ÍÑ•À±İ¥é…É‘}¡…Ñ}¥±İ¥é…É‘}µ•ÍÍ…•}¥±ÕÁ‘…Ñ•‘}…Ğ¤Ù…±Õ•Ì Ä°ÑåÁ”œ°È°Ì±¹½Ü ¤¥€±mÕ¥±9Õµ‰•È¡Ä¹µ•ÍÍ…”¹¡…Ğ¹¥¤±9Õµ‰•È¡Ä¹µ•ÍÍ…”¹µ•ÍÍ…•}¥¥t¤í…İ…¥ĞÍ¡½İ‘‘Ñ…Í¬Äà¡…İ…¥Ğ…‘‘Ñ…Í­M•ÍÍ¥½¸Äà¡Õ¥¤¤íÉ•ÑÕÉ¸ÑÉÕ•ôˆ)¥˜½±¹½Ğ¥¸Ìè(€€€É…¥Í”MåÍÑ•µá¥Ğ II=HèXÌÀÉ•…Ñ”‰ÕÑÑ½¸¡…¹‘±•È¹½Ğ™½Õ¹œ¤)ÌõÌ¹É•Á±…”¡½±±¹•Ü°Ä¤)ÌõÌ¹É•Á±…” ‰í½µµ…¹è…‘‘Ñ…Í¬œ±‘•ÍÉ¥ÁÑ¥½¸èÉ•…Ñ”ÍÁ½¹Í½É•Ñ…Í¬ôˆ°‰í½µµ…¹è…‘‘Ñ…Í¬œ±‘•ÍÉ¥ÁÑ¥½¸èÉ•…Ñ”€˜µ…¹…”ÍÁ½¹Í½É•Ñ…Í­Ìôˆ¤)ÌõÌ¹É•Á±…” œ¼¼€ôôô9]%9HMA=9M=IQM,59HXÌÀ€ôôôœ°œ¼¼€ôôô9]%9HMA=9M=IQM,59HXÌÀ€ôôõq¸¼¼€ôôô]%9HQM,=9QI=1LXÌÔ€ôôôœ°Ä¤)À¹İÉ¥Ñ•}Ñ•áĞ¡Ì¤)ÁÉ¥¹Ğ XÌÔ¥¹ÍÑ…±±•è€½…‘‘Ñ…Í¬‰ÕÑÑ½¹Ì™¥á•…¹Q…Í¬MÑÕ‘¥¼±•…¹•œ¤(