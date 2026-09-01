import 'dotenv/config';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: '2mb' }));

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.get('/health', async (_req, res) => {
  try {
    let db = 'not-configured';
    if (pool) {
      const r = await pool.query('select now() as now');
      db = r.rows[0]?.now ? 'ok' : 'unknown';
    }
    res.json({ ok: true, service: 'wiener-farm-vps', db });
  } catch (e) {
    res.status(500).json({ ok: false, service: 'wiener-farm-vps', db: 'error', error: String(e?.message || e) });
  }
});

// Important: production WIENER routes are intentionally NOT enabled yet.
// They will be added only after the copied PostgreSQL database is verified,
// preserving current behavior while the live Supabase backend remains untouched.
app.use((_req, res) => res.status(404).json({ ok: false, error: 'route_not_enabled_yet' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => console.log(`WIENER VPS backend listening on 127.0.0.1:${port}`));
