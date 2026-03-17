const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load .env from workspace root first, and fallback to functions/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'functions', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_KEY = process.env.TMDB_KEY;
if (!TMDB_KEY) {
  console.warn('WARNING: TMDB_KEY not set. Create functions/.env or set TMDB_KEY in environment.');
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/get-movies', async (req, res) => {
  if (!TMDB_KEY) {
    return res.status(500).json({ error: 'TMDB_KEY missing in server environment' });
  }

  const tmdbPath = (req.query.path || 'trending/movie/day').toString().replace(/^\//, '');
  const tmdbParams = new URLSearchParams({ api_key: TMDB_KEY });
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach(v => tmdbParams.append(key, v));
    else tmdbParams.append(key, value);
  }

  const url = `https://api.themoviedb.org/3/${tmdbPath}?${tmdbParams.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('TMDB proxy error:', err);
    res.status(502).json({ error: 'Failed to fetch TMDB' });
  }
});

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
  console.log('Proxy /get-movies to TMDB (backend key mode)');
});
