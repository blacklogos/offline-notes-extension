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

  // Same idea as normalizeWithMap, but every whitespace character is dropped.
  function tightenWithMap(text) {
    let tight = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      tight += text[i];
      map.push(i);
    }
    return { tight, map };
  }

  /**
   * Find `quote` inside `haystack`.
   * @returns {{start:number,end:number}|null} offsets into the ORIGINAL haystack.
   */
  function locate(haystack, quote, context) {
    if (!haystack || !quote) return null;
    const direct = locateNormalized(haystack, quote, context);
    if (direct) return direct;
    return locateIgnoringWhitespace(haystack, quote, context);
  }

  function locateNormalized(haystack, quote, context) {
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

  /**
   * Fallback for a selection dragged across block elements.
   *
   * range.toString() concatenates the text of separate blocks with no
   * separator at all, so a quote spanning two paragraphs reads
   * "...ends hereStarts there..." while the stored article has a blank line
   * between them. Collapsing whitespace cannot bridge that, because the
   * needle is missing a character the haystack has. Comparing both with all
   * whitespace removed does, and the offsets still map back exactly.
   */
  function locateIgnoringWhitespace(haystack, quote, context) {
    const { tight, map } = tightenWithMap(haystack);
    const needle = (quote || '').replace(/\s/g, '');
    if (!needle || !tight) return null;

    const hits = [];
    let from = 0;
    while (hits.length < 50) {
      const at = tight.indexOf(needle, from);
      if (at === -1) break;
      hits.push(at);
      from = at + 1;
    }
    if (hits.length === 0) return null;
    if (hits.length > 1) {
      // Same rule as above: disambiguate with stored context or refuse.
      const pre = (context && context.prefix || '').replace(/\s/g, '');
      const suf = (context && context.suffix || '').replace(/\s/g, '');
      if (!pre && !suf) return null;
      const scored = hits.map((at) => {
        let score = 0;
        if (pre && tight.slice(Math.max(0, at - pre.length), at).endsWith(pre)) score += 2;
        if (suf && tight.slice(at + needle.length, at + needle.length + suf.length).startsWith(suf)) score += 2;
        return { at, score };
      }).sort((a, b) => b.score - a.score);
      if (scored[0].score === 0) return null;
      if (scored[1] && scored[1].score === scored[0].score) return null;
      hits[0] = scored[0].at;
    }

    const start = map[hits[0]];
    const end = map[hits[0] + needle.length - 1];
    if (start === undefined || end === undefined) return null;
    return { start, end: end + 1 };
  }

  /**
   * Translate an offset range from one rendering of the same words to another.
   *
   * A highlight's text and the article span it was located in are the same
   * words with different whitespace and punctuation spacing, so an offset in
   * one has an exact equivalent in the other. Searching for the substring
   * instead would fail whenever it occurs more than once, which is exactly
   * what happens when someone emphasises a common phrase inside a long quote.
   *
   * Returns null when the two are not the same words, so the caller can fall
   * back rather than produce a wrong range.
   */
  function translateRange(source, target, start, end) {
    if (!source || !target) return null;
    const a = normalizeWithMap(source);
    const b = normalizeWithMap(target);
    if (a.norm !== b.norm || !a.norm) return null;

    // Source index -> normalised index, for the characters normalisation kept.
    const srcToNorm = new Array(source.length);
    for (let i = 0; i < a.map.length; i++) srcToNorm[a.map[i]] = i;

    // A boundary can land on a character normalisation dropped (collapsed
    // whitespace); take the next kept character for a start, the previous for
    // an end, so the range never grows past the words it covered.
    let ns = -1;
    for (let i = start; i < source.length; i++) { if (srcToNorm[i] !== undefined) { ns = srcToNorm[i]; break; } }
    let ne = -1;
    for (let i = end - 1; i >= 0; i--) { if (srcToNorm[i] !== undefined) { ne = srcToNorm[i]; break; } }
    if (ns < 0 || ne < 0 || ne < ns) return null;

    const ts = b.map[ns];
    const te = b.map[ne];
    if (ts === undefined || te === undefined) return null;
    return { start: ts, end: te + 1 };
  }

  const api = { normalize, normalizeWithMap, tightenWithMap, locate, translateRange };
  if (typeof window !== 'undefined') window.TextLocate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
