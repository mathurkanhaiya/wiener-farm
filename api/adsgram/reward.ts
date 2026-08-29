export default async function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const userId=String(req.query?.userId||req.query?.userid||'').trim();
  const secret=String(req.query?.secret||'').trim();
  if(!/^\d{5,20}$/.test(userId))return res.status(400).json({ok:false,error:'invalid_user'});
  if(!secret)return res.status(403).json({ok:false,error:'forbidden'});
  try{
    const url=`https://hvyrairuogiljplmsuat.supabase.co/functions/v1/wiener-adsgram-reward?userId=${encodeURIComponent(userId)}&secret=${encodeURIComponent(secret)}`;
    const r=await fetch(url,{headers:{'cache-control':'no-store'}});
    const text=await r.text();
    res.status(r.status);
    res.setHeader('Content-Type',r.headers.get('content-type')||'application/json');
    res.setHeader('Cache-Control','no-store');
    return res.send(text);
  }catch(e:any){
    return res.status(502).json({ok:false,error:'reward_forward_failed'});
  }
}
