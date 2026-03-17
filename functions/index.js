const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// Stored securely in Google Secret Manager — never exposed to the frontend
const TMDB_KEY = defineSecret('TMDB_KEY');

exports.getMovies = onRequest({ secrets: [TMDB_KEY] }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const tmdbKey = TMDB_KEY.value();
  if (!tmdbKey) {
    return res.status(500).json({ error: 'TMDB_KEY secret not configured' });
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
});
