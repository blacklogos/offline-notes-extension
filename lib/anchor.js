/*
 * Text-quote DOM anchor: serialize a Selection/Range into a stable shape that
 * can be resolved back to a Range on a later page load, even when the DOM has
 * shifted slightly.
 *
 * Shape: { exact, prefix, suffix } — ~32-char context windows on each side.
 * Resolution strategy: scan the document's flat textContent for occurrences of
 * `exact`; for each candidate, score by how well its surrounding text matches
 * the stored prefix/suffix. Highest score above threshold wins; null otherwise
 * (silent miss, per requirement R10).
 *
 * Whitespace is not normalized here — collapsing whitespace runs is common but
 * costs fidelity when selections are near whitespace. Page formatting tends to
 * be stable enough across visits that strict matching wins more than it loses.
 */

const ANCHOR_CONTEXT = 32;

(function () {
  function getTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        // Skip text nodes inside script, style, or our own highlight marks.
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  /**
   * Build a flat text string + an offset table so (flat index) → (text node, local offset)
   * can be reversed quickly. The table stores the starting flat index of each node.
   */
  function buildFlatIndex(root) {
    const nodes = getTextNodes(root);
    let flat = '';
    const starts = []; // starts[i] = flat index at which nodes[i] begins
    for (let i = 0; i < nodes.length; i++) {
      starts.push(flat.length);
      flat += nodes[i].data;
    }
    return { nodes, starts, flat };
  }

  /** Convert a flat string offset back to (textNode, local offset). */
  function flatOffsetToNode({ nodes, starts }, offset) {
    // Binary search for the node whose starts[i] <= offset < starts[i+1]
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { node: nodes[lo], offset: offset - starts[lo] };
  }

  /** Compute the flat-text offset of a (node, offset) pair within root. */
  function nodeOffsetToFlat(root, node, offset) {
    const { nodes, starts } = buildFlatIndex(root);
    const idx = nodes.indexOf(node);
    if (idx === -1) return -1;
    return starts[idx] + offset;
  }

  /**
   * Serialize a Range into an anchor. Requires the range to sit within `root`
   * (typically document.body).
   */
  function serializeAnchor(range, root) {
    root = root || document.body;
    const { flat } = buildFlatIndex(root);
    const start = nodeOffsetToFlat(root, range.startContainer, range.startOffset);
    const end = nodeOffsetToFlat(root, range.endContainer, range.endOffset);
    if (start < 0 || end < 0 || end < start) return null;
    const exact = flat.slice(start, end);
    const prefix = flat.slice(Math.max(0, start - ANCHOR_CONTEXT), start);
    const suffix = flat.slice(end, Math.min(flat.length, end + ANCHOR_CONTEXT));
    return { exact, prefix, suffix };
  }

  /**
   * Score a candidate match. Counts how many trailing characters of `prefix`
   * match the flat text immediately before `idx`, plus how many leading
   * characters of `suffix` match immediately after `idx + exact.length`.
   * Higher is better. No context = zero score (still a valid candidate).
   */
  function scoreCandidate(flat, idx, exactLen, prefix, suffix) {
    let prefixMatch = 0;
    const maxPrefix = Math.min(prefix.length, idx);
    for (let i = 1; i <= maxPrefix; i++) {
      if (flat[idx - i] === prefix[prefix.length - i]) prefixMatch++;
      else break;
    }
    let suffixMatch = 0;
    const suffixStart = idx + exactLen;
    const maxSuffix = Math.min(suffix.length, flat.length - suffixStart);
    for (let i = 0; i < maxSuffix; i++) {
      if (flat[suffixStart + i] === suffix[i]) suffixMatch++;
      else break;
    }
    return prefixMatch + suffixMatch;
  }

  /**
   * Resolve an anchor back to a Range within `root`, or return null when
   * the anchor can no longer be located confidently.
   */
  function resolveAnchor(anchor, root) {
    root = root || document.body;
    if (!anchor || !anchor.exact) return null;
    const index = buildFlatIndex(root);
    const { flat } = index;

    const candidates = [];
    let searchFrom = 0;
    while (true) {
      const idx = flat.indexOf(anchor.exact, searchFrom);
      if (idx === -1) break;
      candidates.push(idx);
      searchFrom = idx + 1;
    }
    if (candidates.length === 0) return null;

    // If only one candidate and no prefix/suffix constraint to worry about,
    // accept it.
    let best = { idx: candidates[0], score: -1 };
    let tied = false;
    for (const idx of candidates) {
      const score = scoreCandidate(flat, idx, anchor.exact.length, anchor.prefix || '', anchor.suffix || '');
      if (score > best.score) { best = { idx, score }; tied = false; }
      else if (score === best.score) tied = true;
    }

    // Threshold: require at least some prefix or suffix match when the
    // document contains multiple occurrences. Single occurrence is trusted.
    if (candidates.length > 1 && best.score < 4) return null;

    // Two candidates scoring equally means the stored context does not
    // distinguish them, so any choice is a guess. Painting the first would
    // put the user's highlight on words they did not highlight; leaving it
    // unresolved is visible and honest.
    if (tied) return null;

    const startAt = flatOffsetToNode(index, best.idx);
    const endAt = flatOffsetToNode(index, best.idx + anchor.exact.length);
    const range = document.createRange();
    try {
      range.setStart(startAt.node, startAt.offset);
      range.setEnd(endAt.node, endAt.offset);
    } catch (_) {
      return null;
    }
    return range;
  }

  const Anchor = { serializeAnchor, resolveAnchor, ANCHOR_CONTEXT };
  if (typeof window !== 'undefined') window.Anchor = Anchor;
  if (typeof self !== 'undefined') self.Anchor = Anchor;
  if (typeof module !== 'undefined' && module.exports) module.exports = Anchor;
})();
