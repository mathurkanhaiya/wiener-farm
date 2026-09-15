// Treasury-only AdsGram callback proxy.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  if(req.method!=='GET') return res.status(405).send('method_not_allowed');
  const raw=Array.isArray(req.query?.userId)?req.query.userId[0]:(req.query?.userId??req.query?.userid);
  const userId=String(raw||'').trim();
  if(!/^\d{1,20}$/.test(userId)) return res.status(400).send('invalid_user');
  try{
    const base=String(process.env.WIENER_API_ORIGIN||'https://api.viralaitools.xyz').replace(/\/$/,'');
    const r=await fetch(`${base}/treasury-reward?userId=${encodeURIComponent(userId)}`,{method:'GET',headers:{accept:'text/plain','cache-control':'no-cache'}});
    const text=await r.text();
    if(r.status===204)return res.status(204).end();
    return res.status(r.status).send(text|| (r.ok?'OK':'treasury_error'));
  }catch(e){console.error('treasury-reward-proxy',e);return res.status(502).send('treasury_upstream_unavailable')}
}
