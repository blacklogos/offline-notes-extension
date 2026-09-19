/*
 * Reader — boot, chrome, and interaction.
 *
 * Opens one saved page note by id: reader/reader.html?page=<id>. It reads only
 * local records and packaged assets. Opening the reader makes no request to
 * the original site; "Open original" is a separate, explicit action.
 */
(() => {
  const PREFS_KEY = 'offline_notes_reader_prefs';
  const SIZES = [17, 19, 21, 23, 26];

  const el = {
    article: document.getElementById('article'),
    rail: document.getElementById('rail'),
    railBtn: document.getElementById('railBtn'),
    railList: document.getElementById('railList'),
    railCount: document.getElementById('railCount'),
    railClose: document.getElementById('railClose'),
    libraryBtn: document.getElementById('libraryBtn'),
    sizeUp: document.getElementById('sizeUp'),
    sizeDown: document.getElementById('sizeDown'),
    selBubble: document.getElementById('selBubble'),
    selHighlight: document.getElementById('selHighlight'),
    selComment: document.getElementById('selComment'),
  };

  const pageStorage = new PageNoteStorage();
  let note = null, located = [], lost = [], sizeIdx = 2, activeId = null;

  const pageId = new URLSearchParams(location.search).get('page');

  // ---- Preferences: text size and where the reader was left ----

  async function loadPrefs() {
    try {
      const r = await chrome.storage.local.get(PREFS_KEY);
      return r[PREFS_KEY] || {};
    } catch (_) { return {}; }
  }
  async function savePrefs(patch) {
    const prefs = await loadPrefs();
    const next = { ...prefs, ...patch };
    if (pageId) next.scroll = { ...(prefs.scroll || {}), ...(patch.scroll || {}) };
    try { await chrome.storage.local.set({ [PREFS_KEY]: next }); } catch (_) {}
  }
  function applySize() {
    document.documentElement.style.setProperty('--reader-size', SIZES[sizeIdx] + 'px');
  }

  // ---- Render ----

  function header() {
    const sc = note.savedContent || {};
    const h1 = document.createElement('h1');
    h1.className = 'doc-title';
    h1.textContent = sc.title || note.pageTitle || note.url;
    const meta = document.createElement('div');
    meta.className = 'doc-meta';
    const bits = [];
    if (sc.byline) bits.push(sc.byline);
    if (sc.siteName) bits.push(sc.siteName);
    if (sc.savedAt) bits.push('saved ' + new Date(sc.savedAt).toLocaleDateString());
    meta.appendChild(document.createTextNode(bits.join(' · ')));
    meta.appendChild(document.createTextNode('  '));
    const a = document.createElement('a');
    a.href = note.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = 'Open original';
    meta.appendChild(a);
    el.article.append(h1, meta);
  }

  function render() {
    el.article.textContent = '';
    header();
    const text = (note.savedContent && note.savedContent.text) || '';
    if (!text) {
      const n = document.createElement('div');
      n.className = 'notice';
      n.textContent = 'No article text is saved for this page yet. Your highlights are still safe in the sidebar.';
      el.article.appendChild(n);
      return;
    }
    const res = window.ReaderArticle.locateHighlights(text, note.highlights || []);
    located = res.located; lost = res.lost;
    window.ReaderArticle.renderArticle(el.article, text, located);
    renderRail();
    el.railBtn.textContent = `Highlights ${(note.highlights || []).length}`;
  }

  function railItem(h, isLost) {
    const item = document.createElement('div');
    item.className = 'rail-item' + (isLost ? ' is-lost' : '');
    item.dataset.hlId = h.id;
    const q = document.createElement('div');
    q.className = 'rail-item-quote';
    q.textContent = (h.anchor && h.anchor.exact) || h.text || '';
    item.appendChild(q);
    if (h.comment) {
      const c = document.createElement('div');
      c.className = 'rail-item-note';
      c.textContent = h.comment;
      item.appendChild(c);
    }
    if (!isLost) item.addEventListener('click', () => focusHighlight(h.id, true));
    return item;
  }

  function renderRail() {
    el.railList.textContent = '';
    const total = (note.highlights || []).length;
    el.railCount.textContent = `${total} highlight${total === 1 ? '' : 's'}` +
      (lost.length ? ` · ${lost.length} not located` : '');
    for (const r of located) el.railList.appendChild(railItem(r.highlight, false));
    if (lost.length) {
      const g = document.createElement('div');
      g.className = 'rail-group';
      // Never drop a highlight just because the snapshot changed shape.
      g.textContent = 'Not located in this saved article';
      el.railList.appendChild(g);
      for (const h of lost) el.railList.appendChild(railItem(h, true));
    }
  }

  function focusHighlight(id, scroll) {
    activeId = id;
    document.querySelectorAll('mark.rd-mark').forEach(m => m.classList.toggle('is-active', m.dataset.hlId === id));
    document.querySelectorAll('.rail-item').forEach(i => i.classList.toggle('is-active', i.dataset.hlId === id));
    if (!scroll) return;
    const mark = document.querySelector(`mark.rd-mark[data-hl-id="${id}"]`);
    if (mark) mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---- Capture from inside the reader ----

  function hideBubble() { el.selBubble.hidden = true; }

  function currentSelectionRange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.article.contains(range.commonAncestorContainer)) return null;
    if (!range.toString().trim()) return null;
    return range;
  }

  function showBubbleFor(range) {
    const rect = range.getBoundingClientRect();
    el.selBubble.hidden = false;
    const b = el.selBubble.getBoundingClientRect();
    let top = rect.top + window.scrollY - b.height - 8;
    if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 8;
    let left = rect.left + rect.width / 2 - b.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
    el.selBubble.style.top = top + 'px';
    el.selBubble.style.left = left + 'px';
  }

  // A highlight made here belongs to the SOURCE page, not to this extension
  // URL, so it shows up in the sidebar and on the live page like any other.
  async function captureSelection(withComment) {
    const range = currentSelectionRange();
    if (!range) return;
    const text = (note.savedContent && note.savedContent.text) || '';
    const start = window.ReaderArticle.offsetOf(el.article, range.startContainer, range.startOffset);
    const end = window.ReaderArticle.offsetOf(el.article, range.endContainer, range.endOffset);
    const exact = range.toString();
    const anchor = (start >= 0 && end > start)
      ? { exact, prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) }
      : { exact, prefix: '', suffix: '' };
    hideBubble();
    try {
      const r = await chrome.runtime.sendMessage({
        type: 'SAVE_HIGHLIGHT',
        payload: { text: exact, anchor, url: note.url, pageTitle: note.pageTitle },
      });
      if (!r || !r.ok) throw new Error((r && r.error) || 'Save failed');
      let comment = '';
      if (withComment) comment = window.prompt('Note for this highlight') || '';
      if (comment) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_HIGHLIGHT_COMMENT', pageNoteId: r.pageNote.id, highlightId: r.highlight.id, comment,
        });
      }
      window.getSelection().removeAllRanges();
      await reload();
      focusHighlight(r.highlight.id, false);
    } catch (err) {
      console.error('Reader capture failed', err);
      alert('Could not save that highlight: ' + err.message);
    }
  }

  // ---- Boot ----

  async function reload() {
    note = await pageStorage.getById(pageId);
    if (!note) {
      el.article.textContent = '';
      const n = document.createElement('div');
      n.className = 'notice';
      n.textContent = 'That page note no longer exists.';
      el.article.appendChild(n);
      return;
    }
    document.title = (note.savedContent && note.savedContent.title) || note.pageTitle || 'Reader';
    render();
  }

  async function init() {
    await applyStoredTheme();
    const prefs = await loadPrefs();
    if (typeof prefs.sizeIdx === 'number') sizeIdx = Math.min(SIZES.length - 1, Math.max(0, prefs.sizeIdx));
    applySize();
    if (!pageId) {
      el.article.textContent = 'No page specified.';
      return;
    }
    await reload();

    const y = prefs.scroll && prefs.scroll[pageId];
    if (typeof y === 'number') window.scrollTo(0, y);

    const setRail = (open) => {
      el.rail.hidden = !open;
      el.railBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('rail-open', open);
    };
    el.railBtn.addEventListener('click', () => setRail(el.rail.hidden));
    el.railClose.addEventListener('click', () => setRail(false));
    window.__setRail = setRail;
    el.libraryBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' }));
    el.sizeUp.addEventListener('click', () => { sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1); applySize(); savePrefs({ sizeIdx }); });
    el.sizeDown.addEventListener('click', () => { sizeIdx = Math.max(0, sizeIdx - 1); applySize(); savePrefs({ sizeIdx }); });
    el.selHighlight.addEventListener('click', () => captureSelection(false));
    el.selComment.addEventListener('click', () => captureSelection(true));

    document.addEventListener('selectionchange', () => {
      const range = currentSelectionRange();
      if (range) showBubbleFor(range); else hideBubble();
    });
    el.article.addEventListener('click', (e) => {
      const mark = e.target.closest && e.target.closest('mark.rd-mark');
      if (mark) {
        focusHighlight(mark.dataset.hlId, false);
        if (el.rail.hidden) window.__setRail(true);
        const item = el.railList.querySelector(`.rail-item[data-hl-id="${mark.dataset.hlId}"]`);
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hideBubble(); return; }
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'h' || e.key === 'H') el.railBtn.click();
    });

    // Remember the reading position, cheaply.
    let scrollT = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(() => savePrefs({ scroll: { [pageId]: Math.round(window.scrollY) } }), 400);
    });
  }

  init();
})();
