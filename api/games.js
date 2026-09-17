const FEED = 'https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=10';
const GAME_HOSTS = new Set(['html5.gamemonetize.co', 'html5.gamemonetize.com', 'html5.gamemonetize.games']);
let cached = null;
let cachedAt = 0;

function safeUrl(value, hosts) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
function clean(value, limit = 300) {
  return String(value || '').replace(/<[^>]*>/g, '').slice(0, limit).trim();
}
function normalize(rows) {
  const seen = new Set();
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const id = clean(row.id, 80), title = clean(row.title, 160);
    const url = safeUrl(row.url, GAME_HOSTS);
    if (!id || !title || !url || seen.has(id)) return [];
    seen.add(id);
    return [{ id, title, url, thumb: safeUrl(row.thumb, new Set(['img.gamemonetize.com'])),
      category: clean(row.category, 60) || 'Arcade', tags: clean(row.tags),
      description: clean(row.description, 1200), instructions: clean(row.instructions, 800) }];
  }).slice(0, 10);
}
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
  if (cached && Date.now() - cachedAt < 300000) return res.status(200).json({ games: cached });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(FEED, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw Error('feed_unavailable');
    const text = await response.text();
    if (text.length > 2000000) throw Error('feed_too_large');
    const rows = JSON.parse(text);
    if (!Array.isArray(rows)) throw Error('invalid_feed');
    const games = normalize(rows);
    if (!games.length) throw Error('empty_feed');
    cached = games; cachedAt = Date.now();
    return res.status(200).json({ games });
  } catch {
    if (cached && Date.now() - cachedAt < 86400000) return res.status(200).json({ games: cached, stale: true });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Games are temporarily unavailable. Please try again.' });
  } finally { clearTimeout(timer); }
}
