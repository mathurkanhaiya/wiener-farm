const WIENER_VPS_URL='https://noon-parent-cakes-colon.trycloudflare.com';

const ALLOWED=new Set([
  'wiener-api','wiener-admin-api','wiener-ad','wiener-ad-usage','wiener-tads','wiener-adsgram-task','wiener-adsgram-reward',
  'wiener-task-api','wiener-bot-task','wiener-exclusive','wiener-mandatory','wiener-withdraw','wiener-withdraw-internal',
  'wiener-ton-wallet','wiener-ton-payout','wiener-payout','wiener-ton-deposit-backfill','wiener-sponsored-task','wiener-device','wiener-promo','wiener-promo-channel','wiener-share','wiener-missions',
  'wiener-referral-status','wiener-notify','wiener-broadcast-run','wiener-notification-worker',
  'wiener-ambassador','wiener-ambassador-publish','wiener-ambassador-board','wiener-ambassador-check-all','wiener-ambassador-retry','wiener-ambassador-retry-trigger','wiener-ambassador-weekly-notify',
  'wiener-auto-giveaway-worker','wiener-giveaway-reminder','wiener-giveaway-reminder-preview',
  'wiener-bot-sync','wiener-bot-router','wiener-bot-start','wiener-user-menu','wiener-bot-leaderboard','wiener-bot-admin','wiener-bot-user-inspector','wiener-bot-broadcast','wiener-bot-pay','wiener-bot-pay-ton','wiener-bot-treasury','wiener-special-task-admin','wiener-bot-addtask','wiener-bot-addtask-target','wiener-admin-action',
  'wiener-migration-audit'
]);

function buildHeaders(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const clientIp=forwarded||String(req.socket?.remoteAddress||'').trim();
  return {
    'content-type':'application/json',
    'apikey':String(req.headers.apikey||''),
    ...(req.headers.authorization?{'authorization':String(req.headers.authorization)}:{}),
    ...(req.headers['x-wiener-internal-secret']?{'x-wiener-internal-secret':String(req.headers['x-wiener-internal-secret'])}:{}),
    ...(req.headers['x-wiener-cron-secret']?{'x-wiener-cron-secret':String(req.headers['x-wiener-cron-secret'])}:{}),
    ...(clientIp?{'x-wiener-client-ip':clientIp}:{}),
    ...(req.headers['x-vercel-ip-country']?{'x-wiener-country':String(req.headers['x-vercel-ip-country'])}:{}),
    ...(req.headers['x-vercel-ip-country-region']?{'x-wiener-region':String(req.headers['x-vercel-ip-country-region'])}:{}),
    ...(req.headers['x-vercel-ip-city']?{'x-wiener-city':String(req.headers['x-vercel-ip-city'])}:{}),
    ...(req.headers['user-agent']?{'x-wiener-user-agent':String(req.headers['user-agent']).slice(0,512)}:{})
  };
}

async function callUpstream(url,headers,body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const upstream=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal,redirect:'manual'});
    const text=await upstream.text();
    return {upstream,text};
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req,res){
  if(req.method==='OPTIONS'){
    res.setHeader('Allow','POST, OPTIONS');
    return res.status(204).end();
  }
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'method_not_allowed'});

  const fn=String(req.query?.fn||'');
  if(!ALLOWED.has(fn)) return res.status(400).json({ok:false,error:'invalid_function'});

  const body=req.body||{};
  let upstreamFn=fn;
  if(fn==='wiener-ad'&&String(body.action||'')==='status'&&!body.session_id) upstreamFn='wiener-ad-usage';
  if(fn==='wiener-admin-api'&&String(body.action||'')==='admin_settings_save') upstreamFn='wiener-admin-settings';

  try{
    const result=await callUpstream(`${WIENER_VPS_URL}/functions/v1/${upstreamFn}`,buildHeaders(req),body);
    res.status(result.upstream.status);
    res.setHeader('content-type',result.upstream.headers.get('content-type')||'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.setHeader('x-wiener-backend','vps');
    return res.send(result.text);
  }catch(error){
    console.error('Wiener VPS request failed',error);
    return res.status(502).json({ok:false,error:'backend_unreachable',message:'Backend connection failed. Please try again.'});
  }
}
