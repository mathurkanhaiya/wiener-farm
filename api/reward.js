export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const userId=String(req.query?.userId||req.query?.userid||'').trim();
  if(!/^\d{5,20}$/.test(userId)) return res.status(400).json({ok:false,error:'bad_user'});
  try{
    const r=await fetch(`https://hvyrairuogiljplmsuat.supabase.co/functions/v1/wiener-treasury-reward?userId=${encodeURIComponent(userId)}`,{headers:{'accept':'application/json'}});
    const text=await r.text();
    res.setHeader('Cache-Control','no-store');
    res.status(r.status).send(text);
  }catch(e){res.status(502).json({ok:false,error:'reward_callback_unavailable'});}
}
