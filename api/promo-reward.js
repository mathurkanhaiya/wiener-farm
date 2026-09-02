const VPS='http://15.235.145.222';
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const qs=new URLSearchParams();
  for(const [k,v] of Object.entries(req.query||{})){
    if(Array.isArray(v)) for(const x of v) qs.append(k,String(x));
    else if(v!=null) qs.set(k,String(v));
  }
  try{
    const r=await fetch(`${VPS}/functions/v1/wiener-promo/reward?${qs.toString()}`,{headers:{'user-agent':'wiener-vercel-callback-proxy'},redirect:'manual'});
    const text=await r.text();
    res.status(r.status);
    res.setHeader('content-type',r.headers.get('content-type')||'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    return res.send(text);
  }catch(e){
    return res.status(502).json({ok:false,error:'vps_unreachable'});
  }
}
