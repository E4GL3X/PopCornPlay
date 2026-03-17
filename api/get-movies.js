// Vercel Serverless Function — TMDB proxy
// TMDB_KEY is set as an Environment Variable in the Vercel dashboard (never in code)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const tmdbKey = process.env.TMDB_KEY;
  if (!tmdbKey) {
    return res.status(500).json({ error: 'TMDB_KEY is not configured' });
  }

  let path = (req.query.path || 'trending/movie/day').toString();
  path = path.replace(/^\//, '');

  const tmdbParams = new URLSearchParams({ api_key: tmdbKey });
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach(v => tmdbParams.append(key, v));
    } else {
      tmdbParams.append(key, value);
    }
  }

  const url = `https://api.themoviedb.org/3/${path}?${tmdbParams.toString()}`;

  try {
    const tmdbResponse = await fetch(url);
    const data = await tmdbResponse.json();
    return res.status(tmdbResponse.status).json(data);
  } catch (err) {
    console.error('TMDB proxy error', err);
    return res.status(502).json({ error: 'Failed to fetch TMDB' });
  }
}
