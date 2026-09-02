const WIENER_VPS_URL='http://15.235.145.222';

const ALLOWED=new Set(['wiener-api','wiener-admin-api','wiener-ad','wiener-tads','wiener-adsgram-task','wiener-task-api','wiener-bot-task','wiener-mandatory','wiener-withdraw','wiener-ton-wallet','wiener-device','wiener-promo','wiener-promo-channel','wiener-share','wiener-missions','wiener-ambassador','wiener-ambassador-publish','wiener-ambassador-board','wiener-ambassador-check-all']);

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

  try{
    const result=await callUpstream(`${WIENER_VPS_URL}/functions/v1/${fn}`,buildHeaders(req),req.body||{});
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
