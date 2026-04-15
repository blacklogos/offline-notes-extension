/*
 * URL canonicalization for page-note deduplication.
 *
 * Rules:
 *   - lowercase host
 *   - drop hash fragment
 *   - strip tracking query params (utm_*, fbclid, gclid, mc_*, _hsenc, _hsmi,
 *     hsCtaTracking, igshid, ref_, ref, source, mkt_tok)
 *   - drop trailing slash on path (except root)
 *   - preserve protocol, port, case of path (path case often matters: /Users vs /users)
 *
 * The function is pure — no side effects, no throws on malformed input (returns
 * the original string).
 */

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^_hs/i,
  /^mc_/i,
];
const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'ref',
  'ref_',
  'source',
  'mkt_tok',
  'hscatracking',
]);

function isTrackingParam(name) {
  const lower = name.toLowerCase();
  if (TRACKING_PARAM_EXACT.has(lower)) return true;
  return TRACKING_PARAM_PATTERNS.some((re) => re.test(lower));
}

function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_) {
    return rawUrl;
  }

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const paramsToDelete = [];
  url.searchParams.forEach((_value, key) => {
    if (isTrackingParam(key)) paramsToDelete.push(key);
  });
  paramsToDelete.forEach((key) => url.searchParams.delete(key));

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

if (typeof window !== 'undefined') window.canonicalizeUrl = canonicalizeUrl;
if (typeof self !== 'undefined') self.canonicalizeUrl = canonicalizeUrl;
if (typeof module !== 'undefined' && module.exports) module.exports = { canonicalizeUrl };
