// AdsGram Reward URL endpoint for Telegram Mini App rewarded ads.
// AdsGram replaces [userId] with the Telegram ID and sends a GET request here
// after the rewarded client-side completion. This endpoint never credits a
// balance itself; it only forwards the provider confirmation to the VPS.
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  res.setHeader('Cache-Control','no-store');

  const raw=Array.isArray(req.query?.userId)?req.query.userId[0]:(req.query?.userId??req.query?.userid);
  const userId=String(raw||'').trim();
  if(!/^\d{1,20}$/.test(userId)) return res.status(400).json({ok:false,error:'invalid_request'});

  const secret=process.env.ADSGRAM_REWARD_SECRET;
  if(!secret){
    console.error('AdsGram reward proxy: ADSGRAM_REWARD_SECRET missing');
    return res.status(503).json({ok:false,error:'service_unavailable'});
  }

  try{
    const base=String(process.env.WIENER_API_ORIGIN||'https://api.viralaitools.xyz').replace(/\/$/,'');
    const upstream=`${base}/functions/v1/wiener-adsgram-reward?userId=${encodeURIComponent(userId)}&secret=${encodeURIComponent(secret)}`;
    const r=await fetch(upstream,{method:'GET',headers:{'accept':'application/json','cache-control':'no-cache'}});
    const text=await r.text();
    let body={ok:r.ok};
    try{body=JSON.parse(text)}catch{}
    if(!r.ok){
      console.error('AdsGram reward upstream failed',r.status,String(body?.error||'upstream_error'));
      return res.status(502).json({ok:false,error:'upstream_error'});
    }
    return res.status(200).json({ok:true,matched:body?.matched===true});
  }catch(e){
    console.error('AdsGram reward proxy error',String(e?.message||e));
    return res.status(502).json({ok:false,error:'upstream_unavailable'});
  }
}
