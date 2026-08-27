const SUPABASE_URL='https://hvyrairuogiljplmsuat.supabase.co';
const ALLOWED=new Set(['wiener-api','wiener-ad','wiener-tads','wiener-adsgram-task','wiener-task-api','wiener-mandatory','wiener-withdraw','wiener-device','wiener-promo-channel','wiener-share','wiener-missions']);

export default async function handler(req,res){
  if(req.method==='OPTIONS'){
    res.setHeader('Allow','POST, OPTIONS');
    return res.status(204).end();
  }
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const fn=String(req.query?.fn||'');
  if(!ALLOWED.has(fn)) return res.status(400).json({ok:false,error:'invalid_function'});
  try{
    const upstream=await fetch(`${SUPABASE_URL}/functions/v1/${fn}`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':String(req.headers.apikey||''),
        ...(req.headers.authorization?{'authorization':String(req.headers.authorization)}:{})
      },
      body:JSON.stringify(req.body||{})
    });
    const text=await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type',upstream.headers.get('content-type')||'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    return res.send(text);
  }catch(error){
    console.error('Supabase proxy failed',error);
    return res.status(502).json({ok:false,error:'backend_unreachable',message:'Backend connection failed. Please try again.'});
  }
}
