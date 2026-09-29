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
  return{text:`📣 TASK STUDIO\n\nCreate and manage sponsored tasks from one clean dashboard.\n\n🟢 Live: ${active}\n⏸ Paused: ${paused}\n🟡 Awaiting payment: ${d.counts.pending}\n✅ Completed: ${d.counts.completed}\n\n💵 100 completions = $0.30\n💎 TON payment · automatic detection`,markup:kb18([[cb18('＋ CREATE TASK','stm30:new')],[cb18(`🟢 LIVE ${active}`,'stm30:list:live'),cb18(`⏸ PAUSED ${paused}`,'stm30:list:paused')],[cb18(`🟡 PAYMENTS ${d.counts.pending}`,'stm30:list:pending'),cb18(`✅ DONE ${d.counts.completed}`,'stm30:list:done')],[cb18('📚 ALL MY TASKS','stm30:list:all')]])};
}'''

listing=r'''async function sponsorBotListV30(uid,mode='all'){
  const d=await sponsorManagerDataV30(uid);let rows=d.orders;
  if(mode==='pending')rows=rows.filter(x=>x.status==='awaiting_payment');
  else if(mode==='live')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled!==false);
  else if(mode==='paused')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)>0&&x.task_enabled===false);
  else if(mode==='done')rows=rows.filter(x=>x.status==='live'&&sponsorNumV30(x.remaining_completions)<=0);
  rows=rows.slice(0,10);
  const title=mode==='pending'?'AWAITING PAYMENT':mode==='live'?'LIVE TASKS':mode==='paused'?'PAUSED TASKS':mode==='done'?'COMPLETED TASKS':'ALL MY TASKS';
  const body=rows.map((x,i)=>{const max=sponsorNumV30(x.max_completions||x.target_completions),done=sponsorNumV30(x.completed_count),left=Math.max(0,max-done),icon=x.status==='awaiting_payment'?'🟡':left<=0?'✅':x.task_enabled===false?'⏸':'🟢';return `${i+1}. ${icon} ${String(x.title||'Task').slice(0,32)}\n   ${done}/${max} done · ${left} left · +${sponsorNumV30(x.reward_per_completion)} WIENER`}).join('\n\n')||'No tasks here yet.';
  return{text:`📚 ${title}\n\n${body}`,markup:kb18([...rows.map(x=>[cb18(`${x.status==='awaiting_payment'?'💳':'⚙️'} ${String(x.title||'Task').slice(0,28)}`,`stm30:show:${x.id}`)]),[cb18('＋ CREATE TASK','stm30:new')],[cb18('◀️ TASK STUDIO','stm30:home')]])};
}'''

show=r'''async function sponsorBotShowV30(uid,id){
  const o=await sponsorOrderV30(uid,id);if(!o)return{text:'Task not found.',markup:kb18([[cb18('◀️ TASK STUDIO','stm30:home')]])};
  const max=sponsorNumV30(o.max_completions||o.target_completions),done=sponsorNumV30(o.completed_count),remaining=Math.max(0,max-done),pct=max?Math.floor(done/max*100):0;
  if(o.status==='awaiting_payment')return{text:`🟡 PAYMENT REQUIRED\n\n${o.title}\n\n👥 ${o.target_completions} completions\n🎁 +${o.reward_per_completion} WIENER each\n💵 $${(sponsorNumV30(o.target_completions)/100*.30).toFixed(2)}\n\n💎 SEND: ${sponsorNumV30(o.package_ton).toFixed(6)} TON\n🏦 TO: ${o.payment_address}\n📝 MEMO: ${o.payment_memo}\n\nSend the exact amount with the exact memo, then tap CHECK PAYMENT.`,markup:kb18([[cb18('✅ CHECK PAYMENT',`stm30:check:${o.id}`)],[cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STUDIO','stm30:home')]])};
  const status=remaining<=0?'✅ COMPLETED':o.task_enabled===false?'⏸ PAUSED':'🟢 LIVE';
  const rows=[];if(remaining>0)rows.push([cb18(o.task_enabled===false?'▶️ RESUME':'⏸ PAUSE',`stm30:toggle:${o.id}:${o.task_enabled===false?'1':'0'}`),cb18('🔄 REFRESH',`stm30:show:${o.id}`)]);
  rows.push([cb18('＋100 · $0.30','stm30:add:'+o.id+':100'),cb18('＋250 · $0.75','stm30:add:'+o.id+':250')]);rows.push([cb18('＋500 · $1.50','stm30:add:'+o.id+':500'),cb18('＋1000 · $3.00','stm30:add:'+o.id+':1000')]);rows.push([cb18('◀️ MY TASKS','stm30:list:all'),cb18('🏠 STU%<����Ѵ��顽����ut��(��ɕ��ɹ�ѕ��逑��х����
܁QM-q�q���ѥѱ��q�q��~N(��푽�������􁍽����ѕ��
܀�������q��~:����ɕ��������ɕ�������q��~:����ɕ݅ɑ}���}������ѥ���]%9H���������ѥ��q��~R\���хɝ��}�ɱ��P��q�q���ɕ������������������䁍�����ѕ��������ɔ�������ѥ��́Ѽ��ո��Ё�������鼹хͭ}�������������͔��Q�ͬ��́���͕���I��յ���Ё���ѥ�����Q�ͬ��́��ѥٔ����=��������Q�̸ͭ������ɭ��魈��ɽ�̥��)����()��ɕ�����}�չ�ѥ���̰�����ͽ�	��!���X���������)��ɕ�����}�չ�ѥ���̰�����ͽ�	��1���X�������ѥ���)��ɕ�����}�չ�ѥ���̰�����ͽ�	��M���X����͡�ܤ)���􉕱͔�������������ܜ��݅�Ёͅ��Q��ࠝ���ݕ��������EՕ�䜱퍅������}�Օ��}���Ĺ���ѕ���Mх�ѥ���хͬ��ɕ�ѽȝ���݅�Ё�х����хͬ��ե���ɕ��ɸ���Օ�)���􉕱͔�������������ܜ��݅�Ё�������хͬ��ե���݅�Ё������Օ�䡁��͕�Ё��Ѽ��Չ����хͭ}��ٕ�ѥ͕�}͕�ͥ��̡ѕ���Ʌ�}����ѕ��ݥ�ɑ}����}���ݥ�ɑ}���ͅ��}�������ѕ�}�Ф�م�Օ̠�İ��������Ȱ�̱��ܠ����mե��9յ��ȡĹ���ͅ������й����9յ��ȡĹ���ͅ������ͅ��}���t��݅�Ё͡����хͬ�ࡅ݅�Ё���хͭM��ͥ����ե����ɕ��ɸ���Օ�)���������Ё�����(����Ʌ�͔�M��ѕ��Р�II=H�X����ɕ�є����ѽ��������ȁ��Ё��չ���)��̹ɕ������������ܰĤ)��̹ɕ�������퍽�����蝅��хͬ����͍ɥ�ѥ���ɕ�є�����ͽɕ��хͬ�􈰉퍽�����蝅��хͬ����͍ɥ�ѥ���ɕ�є��������������ͽɕ��х̝ͭ�)��̹ɕ�������������9�]%9H�MA=9M=I�QM,�59H�X���������������9�]%9H�MA=9M=I�QM,�59H�X������q�������]%9H�QM,�=9QI=1L�X�Ԁ�����Ĥ)���ɥѕ}ѕ�С̤)�ɥ�Р�X�ԁ���х����耽���хͬ����ѽ�́��ᕐ�����Q�ͬ�M�Ց������������(