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
    docHead: document.getElementById('docHead'),
    body: document.getElementById('articleBody'),
    notice: document.getElementById('notice'),
    fontToggle: document.getElementById('fontToggle'),
    darkToggle: document.getElementById('darkToggle'),
    rail: document.getElementById('rail'),
    railBtn: document.getElementById('railBtn'),
    railList: document.getElementById('railList'),
    railCount: document.getElementById('railCount'),
    railClose: document.getElementById('railClose'),
    libraryBtn: document.getElementById('libraryBtn'),
    sizeUp: document.getElementById('sizeUp'),
    sizeDown: document.getElementById('sizeDown'),
    selBubble: document.getElementById('selBubble'),
    selNew: document.getElementById('selNew'),
    selExisting: document.getElementById('selExisting'),
    selBold: document.getElementById('selBold'),
    selColors: document.getElementById('selColors'),
    selColors2: document.getElementById('selColors2'),
    selHighlight: document.getElementById('selHighlight'),
    selComment: document.getElementById('selComment'),
  };

  const pageStorage = new PageNoteStorage();
  let note = null, located = [], lost = [], sizeIdx = 2, activeId = null;
  let face = 'serif', dark = false;
  let currentColor = window.HighlightStyle.DEFAULT_HIGHLIGHT_COLOR;
  let activeMark = null; // the highlight the selection sits inside, if any

  // The same palette and the same remembered choice as the page bubble, so a
  // colour picked while browsing is still selected while reading.
  function buildSwatches(host, onPick) {
    for (const [name, def] of Object.entries(window.HighlightStyle.HIGHLIGHT_COLORS)) {
      const dot = document.createElement('b');
      dot.style.background = def.light;
      dot.title = def.label;
      dot.dataset.color = name;
      dot.addEventListener('mousedown', (e) => e.preventDefault());
      dot.addEventListener('click', (e) => { e.preventDefault(); onPick(name); });
      host.appendChild(dot);
    }
  }

  function paintSwatches() {
    document.querySelectorAll('.sel-colors b').forEach((d) => d.classList.toggle('on', d.dataset.color === currentColor));
  }

  async function pickColor(name) {
    currentColor = name;
    paintSwatches();
    try { await chrome.storage.local.set({ offline_notes_last_color: name }); } catch (_) {}
    if (activeMark) {
      await chrome.runtime.sendMessage({ type: 'RECOLOR_HIGHLIGHT', url: note.url, highlightId: activeMark, color: name });
      await reload();
    }
  }

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

  function applyFace() {
    document.documentElement.dataset.face = face;
    el.fontToggle.textContent = face === 'serif' ? 'Serif' : 'Sans';
  }

  function applyDark() {
    document.documentElement.classList.toggle('rd-dark', dark);
    el.darkToggle.setAttribute('aria-pressed', String(dark));
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
    // An imported file has no web original, so offering the link would be a
    // dead end; show where it came from instead.
    if (window.FileImport && window.FileImport.isImportedUrl(note.url)) {
      const sc = note.savedContent || {};
      if (sc.sourceFile) meta.appendChild(document.createTextNode('  ' + sc.sourceFile));
    } else {
      meta.appendChild(document.createTextNode('  '));
      const a = document.createElement('a');
      a.href = note.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = 'Open original';
      meta.appendChild(a);
    }
    el.docHead.append(h1, meta);
    // The summary belongs above the article it condenses.
    if (note.summary) {
      const sum = document.createElement('div');
      sum.className = 'doc-summary';
      sum.textContent = note.summary;
      el.docHead.appendChild(sum);
    }
  }

  function setNotice(text, actionLabel, onAction) {
    el.notice.textContent = '';
    if (!text) { el.notice.hidden = true; return; }
    el.notice.hidden = false;
    el.notice.appendChild(document.createTextNode(text));
    if (actionLabel) {
      const b = document.createElement('button');
      b.className = 'notice-action';
      b.textContent = actionLabel;
      b.addEventListener('click', onAction);
      el.notice.appendChild(b);
    }
  }

  function render() {
    el.docHead.textContent = '';
    el.body.textContent = '';
    header();
    const text = (note.savedContent && note.savedContent.text) || '';
    if (!text) {
      // A dead end before. Offer the way out: capture it from the live page.
      setNotice('No article text is saved for this page yet. Your highlights are safe.', 'Save it now', saveArticleNow);
      // The rail still renders, so the highlights remain reachable here.
      located = []; lost = note.highlights || [];
      renderRail();
      el.railBtn.textContent = `Highlights ${(note.highlights || []).length}`;
      return;
    }
    setNotice('');
    const res = window.ReaderArticle.locateHighlights(text, note.highlights || []);
    located = res.located; lost = res.lost;
    window.ReaderArticle.renderArticle(el.body, text, located, note.savedContent.blocks);
    renderRail();
    el.railBtn.textContent = `Highlights ${(note.highlights || []).length}`;
  }

  // Capture the article from a tab already showing this URL, so the reader can
  // fill itself instead of sending the user away to press Alt+S.
  async function saveArticleNow() {
    setNotice('Looking for an open tab with this page…');
    try {
      const tabs = await chrome.tabs.query({ url: note.url.split('#')[0] });
      if (!tabs.length) {
        setNotice('Open the page in a tab first, then press Save it now.', 'Open the page', () => {
          chrome.tabs.create({ url: note.url });
        });
        return;
      }
      await chrome.tabs.update(tabs[0].id, { active: true });
      const res = await chrome.runtime.sendMessage({ type: 'SAVE_PAGE_CONTENT' });
      if (!res || !res.ok) { setNotice((res && res.error) || 'Could not read that page.'); return; }
      await reload();
    } catch (err) {
      setNotice('Could not save the article: ' + err.message);
    }
  }

  function railItem(h, isLost) {
    const item = document.createElement('div');
    item.className = 'rail-item' + (isLost ? ' is-lost' : '');
    item.dataset.hlId = h.id;
    const q = document.createElement('div');
    q.className = 'rail-item-quote';
    const quote = (h.anchor && h.anchor.exact) || h.text || '';
    window.HighlightStyle.paintRuns(q, window.HighlightStyle.emphasisRuns(quote, h.emphasis));
    item.appendChild(q);
    item.dataset.color = window.HighlightStyle.colorOf(h);
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
    if (!el.body.contains(range.commonAncestorContainer)) return null;
    if (!range.toString().trim()) return null;
    return range;
  }

  function enclosingMark(range) {
    const node = range.commonAncestorContainer;
    const el0 = node.nodeType === 1 ? node : node.parentElement;
    return el0 && el0.closest ? el0.closest('mark.rd-mark') : null;
  }

  function showBubbleFor(range) {
    const mark = enclosingMark(range);
    activeMark = mark ? mark.dataset.hlId : null;
    // Inside an existing highlight, Highlight would store an overlapping copy;
    // offer the second-pass actions instead.
    el.selNew.hidden = !!activeMark;
    el.selExisting.hidden = !activeMark;
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

  // Offsets of the selection within the highlight's own text, so emphasis
  // travels with the quote rather than with the article.
  function selectionOffsetsInMark(markId) {
    const marks = [...el.body.querySelectorAll(`mark.rd-mark[data-hl-id="${markId}"]`)];
    const sel = window.getSelection();
    if (!marks.length || !sel || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    let consumed = 0, start = -1, end = -1;
    for (const m of marks) {
      const walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n === range.startContainer) start = consumed + range.startOffset;
        if (n === range.endContainer) end = consumed + range.endOffset;
        consumed += n.data.length;
      }
    }
    if (start < 0 || end < 0 || end <= start) return null;
    return { start, end };
  }

  async function emphasiseSelection() {
    if (!activeMark) return;
    const offsets = selectionOffsetsInMark(activeMark);
    hideBubble();
    if (!offsets) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'EMPHASISE_HIGHLIGHT', url: note.url, highlightId: activeMark,
        start: offsets.start, end: offsets.end,
      });
      window.getSelection().removeAllRanges();
      await reload();
    } catch (err) {
      console.error('Emphasis failed', err);
    }
  }

  // A highlight made here belongs to the SOURCE page, not to this extension
  // URL, so it shows up in the sidebar and on the live page like any other.
  async function captureSelection(withComment) {
    const range = currentSelectionRange();
    if (!range) return;

    const text = (note.savedContent && note.savedContent.text) || '';
    const start = window.ReaderArticle.offsetOf(el.body, range.startContainer, range.startOffset);
    const end = window.ReaderArticle.offsetOf(el.body, range.endContainer, range.endOffset);
    // Take the quote from the article text by offset, not from the selection.
    // range.toString() concatenates across block elements with no separator,
    // so a selection dragged over two paragraphs yields "...hereStarts..."
    // which does not appear in the stored text and cannot be located later.
    const usable = start >= 0 && end > start;
    const exact = usable ? text.slice(start, end) : range.toString();
    const anchor = usable
      ? { exact, prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) }
      : { exact, prefix: '', suffix: '' };
    hideBubble();
    try {
      const r = await chrome.runtime.sendMessage({
        type: 'SAVE_HIGHLIGHT',
        payload: { text: exact, anchor, url: note.url, pageTitle: note.pageTitle, color: currentColor },
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
      el.docHead.textContent = ''; el.body.textContent = '';
      setNotice('That page note no longer exists.');
      return;
    }
    document.title = (note.savedContent && note.savedContent.title) || note.pageTitle || 'Reader';
    render();
  }

  async function init() {
    await applyStoredTheme();
    const prefs = await loadPrefs();
    if (typeof prefs.sizeIdx === 'number') sizeIdx = Math.min(SIZES.length - 1, Math.max(0, prefs.sizeIdx));
    if (prefs.face === 'sans' || prefs.face === 'serif') face = prefs.face;
    dark = !!prefs.dark;
    applySize(); applyFace(); applyDark();
    if (!pageId) { setNotice('No page specified.'); return; }
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
    el.fontToggle.addEventListener('click', () => { face = face === 'serif' ? 'sans' : 'serif'; applyFace(); savePrefs({ face }); });
    el.darkToggle.addEventListener('click', () => { dark = !dark; applyDark(); savePrefs({ dark }); });
    buildSwatches(el.selColors, pickColor);
    buildSwatches(el.selColors2, pickColor);
    const storedColor = (await chrome.storage.local.get('offline_notes_last_color')).offline_notes_last_color;
    if (storedColor && window.HighlightStyle.HIGHLIGHT_COLORS[storedColor]) currentColor = storedColor;
    paintSwatches();
    el.selBold.addEventListener('click', () => emphasiseSelection());
    el.selHighlight.addEventListener('click', () => captureSelection(false));
    el.selComment.addEventListener('click', () => captureSelection(true));

    document.addEventListener('selectionchange', () => {
      const range = currentSelectionRange();
      if (range) showBubbleFor(range); else hideBubble();
    });
    el.body.addEventListener('click', (e) => {
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
