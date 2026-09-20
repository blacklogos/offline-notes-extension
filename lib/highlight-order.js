/*
 * Offline Notes — the order highlights are listed in.
 *
 * Three surfaces disagreed before this existed: the reader rail sorted by
 * position in the article, the sidebar hardcoded newest-first, and markdown
 * export used raw array order, which is oldest-first. The same page note read
 * back in three different sequences depending on where you looked.
 *
 * The rail keeps article order on purpose, because it is a map of the text
 * beside it and re-ordering it breaks that correspondence. Everywhere the
 * order is a list rather than a map, this decides it, and the choice is
 * remembered.
 */
(() => {
  const HIGHLIGHT_ORDERS = {
    newest: { label: 'Newest first', reverse: true },
    oldest: { label: 'Oldest first', reverse: false },
  };

  const DEFAULT_HIGHLIGHT_ORDER = 'newest';
  const HIGHLIGHT_ORDER_KEY = 'offline_notes_highlight_order';

  function normalizeOrder(order) {
    return Object.prototype.hasOwnProperty.call(HIGHLIGHT_ORDERS, order) ? order : DEFAULT_HIGHLIGHT_ORDER;
  }

  /**
   * Sort by capture time, oldest or newest first.
   * Records predating capturedAt fall back to their stored position, which is
   * chronological anyway since highlights are only ever appended.
   */
  function sortHighlights(highlights, order) {
    const list = (highlights || []).map((h, i) => ({ h, i }));
    list.sort((a, b) => {
      const ta = Date.parse(a.h.capturedAt || '') || a.i;
      const tb = Date.parse(b.h.capturedAt || '') || b.i;
      return ta === tb ? a.i - b.i : ta - tb;
    });
    const sorted = list.map((x) => x.h);
    return HIGHLIGHT_ORDERS[normalizeOrder(order)].reverse ? sorted.reverse() : sorted;
  }

  async function loadHighlightOrder() {
    try {
      const r = await chrome.storage.local.get(HIGHLIGHT_ORDER_KEY);
      return normalizeOrder(r[HIGHLIGHT_ORDER_KEY]);
    } catch (_) {
      return DEFAULT_HIGHLIGHT_ORDER;
    }
  }

  async function saveHighlightOrder(order) {
    const next = normalizeOrder(order);
    try { await chrome.storage.local.set({ [HIGHLIGHT_ORDER_KEY]: next }); } catch (_) {}
    return next;
  }

  const api = { HIGHLIGHT_ORDERS, DEFAULT_HIGHLIGHT_ORDER, HIGHLIGHT_ORDER_KEY,
                normalizeOrder, sortHighlights, loadHighlightOrder, saveHighlightOrder };
  if (typeof window !== 'undefined') window.HighlightOrder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})();
