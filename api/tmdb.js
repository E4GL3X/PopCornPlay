// Vercel Serverless Function: TMDB API Proxy
// This replaces the Firebase Function to work natively on Vercel.

const fetch = require('node-fetch');

// Paths that are allowed to be proxied (whitelist for security)
const ALLOWED_PATH_PREFIXES = [
  '/trending/',
  '/movie/',
  '/tv/',
  '/search/',
  '/genre/',
  '/person/',
  '/discover/',
  '/collection/',
  '/configuration',
  '/find/',
  '/review/',
  '/network/',
  '/keyword/',
  '/credit/',
];

function isPathAllowed(path) {
  return ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p));
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract the TMDB path from the URL
  // Vercel routes /api/tmdb/foo to this file. req.url will be /api/tmdb/foo
  let tmdbPath = req.url.replace('/api/tmdb', '').split('?')[0] || '/';
  
  // Safety checks
  tmdbPath = tmdbPath.replace(/\.\./g, '').replace(/\/+/g, '/');
  if (!tmdbPath.startsWith('/')) tmdbPath = '/' + tmdbPath;

  if (!isPathAllowed(tmdbPath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not configured in Vercel Environment Variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Forward query params
  const forwardedParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'api_key' && k !== 'access_token') {
      forwardedParams.append(k, Array.isArray(v) ? v[0] : v);
    }
  }
  forwardedParams.set('api_key', TMDB_API_KEY);

  const upstream = `https://api.themoviedb.org/3${tmdbPath}?${forwardedParams.toString()}`;

  try {
    const tmdbRes = await fetch(upstream, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PopCornPlay/Vercel',
      },
      timeout: 10000,
    });

    const body = await tmdbRes.json();
    
    if (tmdbRes.ok) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    }

    res.status(tmdbRes.status).json(body);
  } catch (err) {
    console.error('TMDB proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach TMDB', detail: err.message });
  }
};
