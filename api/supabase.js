const SUPABASE_URL='https://hvyrairuogiljplmsuat.supabase.co';
const WIENER_VPS_URL=process.env.WIENER_VPS_URL||'http://15.235.145.222';

const ALLOWED=new Set(['wiener-api','wiener-admin-api','wiener-ad','wiener-tads','wiener-adsgram-task','wiener-task-api','wiener-mandatory','wiener-withdraw','wiener-device','wiener-promo-channel','wiener-share','wiener-missions','wiener-ambassador','wiener-ambassador-publish','wiener-ambassador-board','wiener-ambassador-check-all']);

// These actions are already implemented by the VPS compatibility API.
// Everything else keeps using Supabase until its VPS route is migrated.
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
  const useVps=fn==='wiener-api'&&VPS_WIENER_API_ACTIONS.has(action);
  const upstreamBase=useVps?WIENER_VPS_URL:SUPABASE_URL;
  const upstreamUrl=useVps
    ? `${upstreamBase}/functions/v1/wiener-api`
    : `${upstreamBase}/functions/v1/${fn}`;

  try{
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
    const clientIp=forwarded||String(req.socket?.remoteAddress||'').trim();

    const upstream=await fetch(upstreamUrl,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':String(req.headers.apikey||''),
        ...(req.headers.authorization?{'authorization':String(req.headers.authorization)}:{}),
        ...(clientIp?{'x-wiener-client-ip':clientIp}:{}),
        ...(req.headers['x-vercel-ip-country']?{'x-wiener-country':String(req.headers['x-vercel-ip-country'])}:{}),
        ...(req.headers['x-vercel-ip-country-region']?{'x-wiener-region':String(req.headers['x-vercel-ip-country-region'])}:{}),
        ...(req.headers['x-vercel-ip-city']?{'x-wiener-city':String(req.headers['x-vercel-ip-city'])}:{}),
        ...(req.headers['user-agent']?{'x-wiener-user-agent':String(req.headers['user-agent']).slice(0,512)}:{})
      },
      body:JSON.stringify(body)
    });

    const text=await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type',upstream.headers.get('content-type')||'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.setHeader('x-wiener-backend',useVps?'vps':'supabase');
    return res.send(text);
  }catch(error){
    console.error(`${useVps?'VPS':'Supabase'} proxy failed`,error);
    return res.status(502).json({ok:false,error:'backend_unreachable',message:'Backend connection failed. Please try again.'});
  }
}
