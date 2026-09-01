import express from 'express';

const app = express();
app.use(express.json({ limit: '8mb' }));

const target = 'http://127.0.0.1:54322';

app.get('/health', async (_req, res) => {
  try {
    const r = await fetch(`${target}/rest/v1/users?select=id&limit=1`);
    res.status(r.ok ? 200 : 503).json({ ok: r.ok, service: 'wiener-vps-gateway', rest: r.status });
  } catch (e) {
    res.status(503).json({ ok: false, service: 'wiener-vps-gateway', error: String(e?.message || e) });
  }
});

app.all('/functions/v1/:fn', async (req, res) => {
  const fn = String(req.params.fn || '').trim();
  if (!/^wiener-[a-z0-9-]+$/.test(fn)) return res.status(400).json({ ok:false, error:'invalid_function' });
  try {
    const qs = new URLSearchParams(req.query || {}).toString();
    const url = `${target}/functions/v1/${fn}${qs ? `?${qs}` : ''}`;
    const headers = {};
    for (const key of ['authorization','apikey','content-type','x-wiener-client-ip','x-wiener-country','x-wiener-region','x-wiener-city','x-wiener-user-agent','x-wiener-cron-secret','x-wiener-internal-secret','x-telegram-bot-api-secret-token']) {
      const v = req.headers[key];
      if (v != null) headers[key] = String(v);
    }
    if (!headers['content-type']) headers['content-type'] = 'application/json';
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {})
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    return res.send(buf);
  } catch (e) {
    console.error('gateway upstream error', e);
    return res.status(502).json({ ok:false, error:'runtime_unreachable' });
  }
});

app.use((_req,res)=>res.status(404).json({ok:false,error:'not_found'}));
const port = Number(process.env.PORT || 3000);
app.listen(port,'127.0.0.1',()=>console.log(`WIENER gateway on 127.0.0.1:${port}`));
