// Treasury AdsGram Reward URL proxy.
// AdsGram calls /treasury-reward?userId=[userId]. Keep the public callback on
// Vercel and forward it to the same VPS origin used by the rest of Wiener Farm.
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  res.setHeader('Cache-Control','no-store');

  const raw=Array.isArray(req.query?.userId)?req.query.userId[0]:(req.query?.userId??req.query?.userid);
  const userId=String(raw||'').trim();
  if(!/^\d{1,20}$/.test(userId)) return res.status(400).json({ok:false,error:'invalid_request'});

  try{
    const base=String(process.env.WIENER_API_ORIGIN||'https://api.viralaitools.xyz').replace(/\/$/,'');
    const upstream=`${base}/treasury-reward?userId=${encodeURIComponent(userId)}`;
    const r=await fetch(upstream,{method:'GET',headers:{accept:'text/plain,application/json','cache-control':'no-cache'}});
    const text=await r.text();

    // 204 means the VPS received the callback but there was no matching pending
    // Treasury session. Preserve it instead of falsely reporting a credit.
    if(r.status===204) return res.status(204).end();
    if(!r.ok){
      console.error('Treasury reward upstream failed',r.status,text.slice(0,200));
      return res.status(r.status).send(text||'upstream_error');
    }
    return res.status(200).send(text||'OK');
  }catch(e){
    console.error('Treasury reward proxy error',String(e?.message||e));
    return res.status(502).json({ok:false,error:'upstream_unavailable'});
  }
}
