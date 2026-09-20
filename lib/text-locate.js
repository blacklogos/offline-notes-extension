/*
 * Offline Notes — locate a stored quote inside saved article text.
 *
 * Highlights are anchored against the LIVE page DOM, where text comes with the
 * page's own spacing. The saved article is rebuilt by lib/page-content.js,
 * which collapses whitespace and tightens punctuation spacing. So a quote that
 * matched perfectly on the page often does not appear verbatim in the
 * snapshot, and a naive indexOf misses legitimate highlights.
 *
 * Both sides are normalised the same way, the match runs on the normalised
 * text, and the result is mapped back to real offsets in the original string
 * so painting stays accurate.
 *
 * A quote that appears more than once is resolved with its stored prefix and
 * suffix context. If context cannot single one out, the quote is reported
 * unlocated rather than painted in the wrong place.
 */
(() => {
  // Collapse whitespace and remove the spaces around punctuation that differ
  // between a live DOM read and the rebuilt article text.
  function normalizeWithMap(text) {
    let norm = '';
    const map = []; // map[i] = index in `text` of normalised char i
    let lastWasSpace = true; // leading space is dropped
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        if (lastWasSpace) continue;
        norm += ' '; map.push(i); lastWasSpace = true;
        continue;
      }
      // Drop a space we just emitted when the next char closes punctuation.
      if (/[.,;:!?)\]]/.test(ch) && norm.endsWith(' ')) {
        norm = norm.slice(0, -1); map.pop();
      }
      norm += ch; map.push(i); lastWasSpace = false;
      // A space right after an opening bracket is noise too.
      if (/[([]/.test(ch)) lastWasSpace = true;
    }
    while (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
    return { norm, map };
  }

  function normalize(text) {
    return normalizeWithMap(text || '').norm;
  }

  /**
   * Find `quote` inside `haystack`.
   * @returns {{start:number,end:number}|null} offsets into the ORIGINAL haystack.
   */
  function locate(haystack, quote, context) {
    if (!haystack || !quote) return null;
    const { norm, map } = normalizeWithMap(haystack);
    const needle = normalize(quote);
    if (!needle) return null;

    const hits = [];
    let from = 0;
    while (hits.length < 50) {
      const at = norm.indexOf(needle, from);
      if (at === -1) break;
      hits.push(at);
      from = at + 1;
    }
    if (hits.length === 0) return null;

    let chosen = hits[0];
    if (hits.length > 1) {
      // Ambiguous. Score each candidate by how much of the stored prefix and
      // suffix actually surrounds it, and demand a single clear winner.
      const pre = normalize(context && context.prefix);
      const suf = normalize(context && context.suffix);
      if (!pre && !suf) return null;
      const scored = hits.map((at) => {
        let score = 0;
        if (pre) {
          // trimEnd: the word boundary before a quote is a space in the
          // normalised text, so a raw endsWith would never match.
          const before = norm.slice(Math.max(0, at - pre.length - 8), at).trimEnd();
          if (before.endsWith(pre)) score += 2;
          else if (pre.length > 6 && before.includes(pre.slice(-6))) score += 1;
        }
        if (suf) {
          const after = norm.slice(at + needle.length, at + needle.length + suf.length + 8).trimStart();
          if (after.startsWith(suf)) score += 2;
          else if (suf.length > 6 && after.includes(suf.slice(0, 6))) score += 1;
        }
        return { at, score };
      }).sort((a, b) => b.score - a.score);
      if (scored[0].score === 0) return null;
      if (scored[1] && scored[1].score === scored[0].score) return null; // tie: refuse to guess
      chosen = scored[0].at;
    }

    const startNorm = chosen;
    const endNorm = chosen + needle.length - 1;
    if (map[startNorm] === undefined || map[endNorm] === undefined) return null;
    return { start: map[startNorm], end: map[endNorm] + 1 };
  }

  const api = { normalize, normalizeWithMap, locate };
  if (typeof window !== 'undefined') window.TextLocate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
