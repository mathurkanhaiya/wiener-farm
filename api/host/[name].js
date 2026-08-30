const SUPABASE_URL='https://hvyrairuogiljplmsuat.supabase.co';

export default async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end('Method Not Allowed');
  const name=String(req.query?.name||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) return res.status(400).end('Invalid asset name');
  try{
    const upstream=await fetch(`${SUPABASE_URL}/storage/v1/object/public/wiener-host/${encodeURIComponent(name)}`,{method:req.method==='HEAD'?'HEAD':'GET'});
    if(!upstream.ok) return res.status(upstream.status).end(upstream.status===404?'Asset not found':'Asset unavailable');
    res.setHeader('content-type',upstream.headers.get('content-type')||'application/octet-stream');
    res.setHeader('cache-control','public, max-age=300, stale-while-revalidate=3600');
    res.setHeader('x-content-type-options','nosniff');
    const length=upstream.headers.get('content-length'); if(length) res.setHeader('content-length',length);
    if(req.method==='HEAD') return res.status(200).end();
    const bytes=Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(bytes);
  }catch(error){
    console.error('Hosted asset proxy failed',error);
    return res.status(502).end('Asset unavailable');
  }
}
