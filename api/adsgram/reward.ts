export default async function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const userId=String(req.query?.userId||req.query?.userid||'').trim();
  if(!/^\d{5,20}$/.test(userId))return res.status(400).json({ok:false,error:'invalid_user'});
  try{
    const r=await fetch(`https://hvyrairuogiljplmsuat.supabase.co/functions/v1/wiener-promo/reward?userId=${encodeURIComponent(userId)}`);
    const text=await r.text();
    res.status(r.status).setHeader('Content-Type',r.headers.get('content-type')||'application/json').send(text);
  }catch(e:any){
    res.status(502).json({ok:false,error:'reward_forward_failed'});
  }
}
