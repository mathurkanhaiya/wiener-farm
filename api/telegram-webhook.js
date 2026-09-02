const VPS='http://15.235.145.222';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(200).send('ok');
  try{
    const headers={'content-type':'application/json'};
    const secret=req.headers['x-telegram-bot-api-secret-token'];
    if(secret) headers['x-telegram-bot-api-secret-token']=String(secret);
    const r=await fetch(`${VPS}/functions/v1/wiener-bot-webhook`,{method:'POST',headers,body:JSON.stringify(req.body||{}),redirect:'manual'});
    const text=await r.text();
    res.status(r.status);
    res.setHeader('content-type',r.headers.get('content-type')||'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    return res.send(text);
  }catch(e){
    return res.status(502).json({ok:false,error:'vps_unreachable'});
  }
}
