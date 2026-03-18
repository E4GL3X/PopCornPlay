/**
 * PopCornPlay – TMDB API Proxy (Firebase Cloud Function)
 *
 * All TMDB requests are proxied through this function so the API key
 * is NEVER exposed to the browser / GitHub. The key is stored as a
 * Firebase Functions environment secret (set via `firebase functions:secrets:set TMDB_API_KEY`).
 */

'use strict';

const functions = require('firebase-functions');
const fetch     = require('node-fetch');

// ─── Configuration ─────────────────────────────────────────────────────────
const TMDB_BASE      = 'https://api.themoviedb.org/3';
const ALLOWED_ORIGIN = '*'; // Tighten to your domain in production if desired

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

// ─── Helpers ────────────────────────────────────────────────────────────────
function isPathAllowed(path) {
  return ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p));
}

function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Cloud Function ──────────────────────────────────────────────────────────
// Deployed at:  /api/tmdb/<path>
// Example call: /api/tmdb/trending/movie/week?language=en-US
//
// The frontend calls this URL; the function appends the real API key
// before forwarding to TMDB and strips it from every response.

exports.tmdbProxy = functions.https.onRequest(async (req, res) => {
  // CORS pre-flight
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only GET is needed for TMDB reads
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Resolve the TMDB path ─────────────────────────────────────────────
  // Firebase rewrites strip the /api/tmdb prefix before passing to the
  // function, so req.path is already the TMDB sub-path (e.g. /trending/movie/week).
  let tmdbPath = req.path || '/';

  // Safety: remove any traversal attempts
  tmdbPath = tmdbPath.replace(/\.\./g, '').replace(/\/+/g, '/');
  if (!tmdbPath.startsWith('/')) tmdbPath = '/' + tmdbPath;

  // Whitelist check
  if (!isPathAllowed(tmdbPath)) {
    res.status(403).json({ error: 'Path not allowed' });
    return;
  }

  // ── Grab the API key from Firebase secret ────────────────────────────
  // On deployed functions: set via `firebase functions:secrets:set TMDB_API_KEY`
  // For local emulator: uses functions/.env (gitignored)
  const TMDB_API_KEY =
    (functions.config().tmdb && functions.config().tmdb.key) ||
    process.env.TMDB_API_KEY;

  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not configured');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // ── Forward query params (except any stray api_key the client sent) ──
  const forwardedParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'api_key' && k !== 'access_token') {
      forwardedParams.append(k, v);
    }
  }
  forwardedParams.set('api_key', TMDB_API_KEY); // server-side only

  const upstream = `${TMDB_BASE}${tmdbPath}?${forwardedParams.toString()}`;

  // ── Fetch from TMDB ──────────────────────────────────────────────────
  try {
    const tmdbRes = await fetch(upstream, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PopCornPlay/2.0',
      },
      timeout: 10000,
    });

    const body = await tmdbRes.json();

    // Cache successful responses for 5 minutes at the CDN layer
    if (tmdbRes.ok) {
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    }

    res.status(tmdbRes.status).json(body);
  } catch (err) {
    console.error('TMDB proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach TMDB', detail: err.message });
  }
});
