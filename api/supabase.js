const SUPABASE_URL='https://hvyrairuogiljplmsuat.supabase.co';
const WIENER_VPS_URL='http://15.235.145.222';

const ALLOWED=new Set(['wiener-api','wiener-admin-api','wiener-ad','wiener-tads','wiener-adsgram-task','wiener-task-api','wiener-mandatory','wiener-withdraw','wiener-device','wiener-promo-channel','wiener-share','wiener-missions','wiener-ambassador','wiener-ambassador-publish','wiener-ambassador-board','wiener-ambassador-check-all']);

const VPS_WIENER_API_ACTIONS=new Set([
  'admin_adjust_balance',
  'admin_ban',
  'admin_bootstrap',
  'admin_unban',
  'app_opened',
  'bootstrap',
  'daily_claim',
  'farm_claim',
  'farm_start',
  'promo_claim',
  'promo_redeem',
  'referral_refresh'
]);

const VPS_FUNCTIONS=new Set([
  'wiener-ad',
  'wiener-tads',
  'wiener-adsgram-task'
]);

function buildHeaders(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const clientIp=forwarded||String(req.socket?.remoteAddress||'').trim();
  return {
    'content-type':'application/json',
    'apikey':String(req.headers.apikey||''),
    ...(req.headers.authorization?{'authorization':String(req.headers.authorization)}:{}),
    ...(clientIp?{'x-wiener-client-ip':clientIp}:{}),
    ...(req.headers['x-vercel-ip-country']?{'x-wiener-country':String(req.headers['x-vercel-ip-country'])}:{}),
    ...(req.headers['x-vercel-ip-country-region']?{'x-wiener-region':String(req.headers['x-vercel-ip-country-region'])}:{}),
    ...(req.headers['x-vercel-ip-city']?{'x-wiener-city':String(req.headers['x-vercel-ip-city'])}:{}),
    ...(req.headers['user-agent']?{'x-wiener-user-agent':String(req.headers['user-agent']).slice(0,512)}:{})
  };
}

async function callUpstream(url,headers,body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
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
  const action=String(body?.action||'');
  const useVps=VPS_FUNCTIONS.has(fn)||(fn==='wiener-api'&&VPS_WIENER_API_ACTIONS.has(action));
  const headers=buildHeaders(req);

  let result=null;
  let backend='supabase';

  if(useVps){
    try{
      const vpsPath=fn==='wiener-api'?'wiener-api':fn;
      const vps=await callUpstream(`${WIENER_VPS_URL}/functions/v1/${vpsPath}`,headers,body);
      if(vps.upstream.status<500 && !(vps.upstream.status>=300 && vps.upstream.status<400)){
        result=vps;
        backend='vps';
      } else {
        console.error('VPS unavailable for request',vps.upstream.status);
      }
    }catch(error){
      console.error('VPS request failed; falling back to Supabase',error);
    }
  }

  if(!result){
    try{
      result=await callUpstream(`${SUPABASE_URL}/functions/v1/${fn}`,headers,body);
      backend=useVps?'supabase-fallback':'supabase';
    }catch(error){
      console.error('Supabase request failed',error);
      return res.status(502).json({ok:false,error:'backend_unreachable',message:'Backend connection failed. Please try again.'});
    }
  }

  res.status(result.upstream.status);
  res.setHeader('content-type',result.upstream.headers.get('content-type')||'application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-wiener-backend',backend);
  return res.send(result.text);
}
