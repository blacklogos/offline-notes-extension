/*
 * Offline Notes — in-page highlight capture + re-paint.
 */

(() => {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (window.__offlineNotesHighlightLoaded) return;
  window.__offlineNotesHighlightLoaded = true;

  const BUBBLE_TAG = 'offline-notes-bubble';
  const MARK_CLASS = 'offline-notes-highlight';
  const FLASH_CLASS = 'offline-notes-flash';
  const DEBOUNCE_MS = 180;

  function isCtxOk() { return !!(chrome.runtime && chrome.runtime.id); }
  async function send(msg) {
    if (!isCtxOk()) throw new Error('Extension reloaded — refresh the page.');
    return chrome.runtime.sendMessage(msg);
  }

  // ---- Bubble ----

  let host = null, root = null, wrap = null;
  let hideT = null, lastText = '', saveCtx = null, commenting = false, lastRect = null;

  function ensureBubble() {
    if (host && document.body.contains(host)) return;
    if (host) host.remove();
    host = document.createElement(BUBBLE_TAG);
    host.style.cssText = 'all:initial;position:absolute;z-index:2147483647;top:0;left:0;pointer-events:none;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .w{position:fixed;width:max-content;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity 100ms ease-out,transform 100ms ease-out;background:#FAF7F2;border:1px solid #D8D0BF;border-radius:10px;box-shadow:0 2px 10px rgba(42,38,34,.12);overflow:hidden}
        .w.on{opacity:1;transform:translateY(0);pointer-events:auto}
        .bar{display:flex;align-items:stretch;background:transparent}
        .b{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:7px 12px;border:none;background:transparent;font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2A2622;cursor:pointer;white-space:nowrap}
        .b:hover{background:#EAE4D8}
        .b .i{display:inline-flex;width:16px;height:16px;color:#7C9885}
        .b .i svg{width:100%;height:100%}
        .b.ok{color:#5F7A6A}
        .b.ok .i{color:#5F7A6A}
        .b.err{color:#8A4A3E}
        .sep{width:1px;background:#D8D0BF;flex-shrink:0;margin:6px 0}
        .cm{display:none;padding:8px 10px 10px;border-top:1px solid #EAE4D8}
        .cm.on{display:block}
        .ta{display:block;width:240px;min-height:48px;max-height:80px;padding:6px 8px;font:400 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2A2622;background:#F5F1EA;border:1px solid #D8D0BF;border-radius:6px;resize:none;outline:none}
        .ta:focus{border-color:#7C9885}
        .ta::placeholder{color:#A09888}
        .ht{margin-top:5px;font:400 11px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#A09888;text-align:right}
      </style>
      <div class="w">
        <div class="bar">
          <button class="b" id="saveBtn"><span class="i" id="ico"></span><span id="lbl">Save</span></button>
          <span class="sep"></span>
          <button class="b" id="noteBtn" title="Save and add a note" aria-label="Save and add a note"><span class="i" id="ico2"></span></button>
        </div>
        <div class="cm" id="cm">
          <textarea class="ta" id="ta" rows="2" maxlength="280" aria-label="Note for this highlight" placeholder="Add a note…"></textarea>
          <div class="ht">Enter ↵ save · Esc cancel · <span id="cc">280</span></div>
        </div>
      </div>`;
    document.body.appendChild(host);
    wrap = root.querySelector('.w');
    const saveBtn = root.getElementById('saveBtn');
    const noteBtn = root.getElementById('noteBtn');
    root.getElementById('ico').innerHTML = window.Icons?.sparkle || '✦';
    root.getElementById('ico2').innerHTML = window.Icons?.pencil || '✎';

    saveBtn.addEventListener('mousedown', e => e.preventDefault());
    noteBtn.addEventListener('mousedown', e => e.preventDefault());
    saveBtn.addEventListener('click', e => { e.preventDefault(); doCapture(false); });
    noteBtn.addEventListener('click', e => { e.preventDefault(); doCapture(true); });
  }

  const EDGE = 6;

  // wrap is position:fixed → coords are viewport-relative, same as getBoundingClientRect.
  // Measure the real bubble rather than assuming the collapsed pill's size: it grows
  // when the comment panel opens, and the old fixed offsets pushed it offscreen.
  function pos(rect) {
    ensureBubble();
    const b = wrap.getBoundingClientRect();
    const w = b.width || 140;
    const h = b.height || 34;
    let t = rect.top - h - EDGE;
    if (t < EDGE) t = rect.bottom + EDGE; // no room above: flip below the selection
    t = Math.max(EDGE, Math.min(t, window.innerHeight - h - EDGE));
    let l = rect.left + rect.width / 2 - w / 2;
    l = Math.max(EDGE, Math.min(l, window.innerWidth - w - EDGE));
    wrap.style.top = t + 'px';
    wrap.style.left = l + 'px';
  }

  // Re-anchor against the selection the bubble was opened for, after its size changes.
  function reposition() {
    if (lastRect) pos(lastRect);
  }

  function show(rect) {
    ensureBubble();
    saveCtx = null; // new selection: never reuse the previous capture's context
    lastRect = rect;
    pos(rect);
    wrap.classList.add('on');
    const lbl = root.getElementById('lbl');
    const ico = root.getElementById('ico');
    const btn = root.getElementById('saveBtn');
    btn.classList.remove('ok', 'err');
    lbl.textContent = 'Save';
    ico.innerHTML = window.Icons?.sparkle || '✦';
    root.getElementById('cm').classList.remove('on');
    clearTimeout(hideT);
  }

  function hide() {
    if (!host || commenting) return;
    root.getElementById('cm').classList.remove('on');
    wrap.classList.remove('on');
  }

  function flash(ok, ctx) {
    if (!root) return;
    const btn = root.getElementById('saveBtn');
    const lbl = root.getElementById('lbl');
    const ico = root.getElementById('ico');
    btn.classList.remove('ok', 'err');
    btn.classList.add(ok ? 'ok' : 'err');
    lbl.textContent = ok ? 'Saved' : 'Failed';
    ico.innerHTML = ok ? (window.Icons?.check || '✓') : (window.Icons?.x || '✗');
    clearTimeout(hideT);
    saveCtx = ok ? ctx : null;
  }

  function openComment() {
    if (!root) return;
    commenting = true;
    const cm = root.getElementById('cm');
    const ta = root.getElementById('ta');
    const cc = root.getElementById('cc');
    cm.classList.add('on');
    ta.value = '';
    cc.textContent = '280';
    reposition(); // the bubble just got taller; keep it against the selection and onscreen
    setTimeout(() => ta.focus(), 50);

    const done = async () => {
      const txt = ta.value.trim().slice(0, 280);
      // cleanup() nulls saveCtx, so read it first or the comment never reaches storage.
      const ctx = saveCtx;
      cleanup();
      if (txt && ctx) {
        try { await send({ type: 'UPDATE_HIGHLIGHT_COMMENT', pageNoteId: ctx.pn, highlightId: ctx.hl, comment: txt }); } catch (_) {}
      }
      hide();
    };
    const cancel = () => { cleanup(); hide(); };
    const kd = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    const inp = () => { cc.textContent = String(280 - ta.value.length); };
    const blur = () => setTimeout(done, 80);
    ta.addEventListener('keydown', kd);
    ta.addEventListener('input', inp);
    ta.addEventListener('blur', blur);
    function cleanup() { commenting = false; ta.removeEventListener('keydown', kd); ta.removeEventListener('input', inp); ta.removeEventListener('blur', blur); cm.classList.remove('on'); saveCtx = null; }
  }

  // ---- Selection tracking ----

  let debT = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(debT);
    debT = setTimeout(() => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) { hide(); return; }
      const t = s.toString();
      if (!t || !t.trim()) { hide(); return; }
      try {
        const an = s.anchorNode;
        if (an && an.closest && an.closest(BUBBLE_TAG)) return;
      } catch (_) {}
      lastText = t;
      const r = s.getRangeAt(0);
      const rc = r.getBoundingClientRect();
      if (rc.width === 0 && rc.height === 0) return;
      show(rc);
    }, DEBOUNCE_MS);
  });

  document.addEventListener('mousedown', e => {
    if (!host) return;
    if (e.composedPath && e.composedPath().includes(host)) return;
    setTimeout(() => { const s = window.getSelection(); if (!s || s.isCollapsed) hide(); }, 20);
  });

  // ---- Capture ----

  function getRange() {
    const s = window.getSelection();
    return (s && !s.isCollapsed && s.rangeCount > 0) ? s.getRangeAt(0) : null;
  }

  let capturing = false;

  async function doCapture(withComment) {
    if (capturing) return;
    // Already saved this selection: annotate the existing highlight instead of appending a second one.
    if (withComment && saveCtx) { openComment(); return; }
    capturing = true;
    try {
      await runCapture(withComment);
    } finally {
      capturing = false;
    }
  }

  async function runCapture(withComment) {
    const range = getRange();
    let payload;
    if (range) {
      const anchor = window.Anchor.serializeAnchor(range, document.body);
      const text = range.toString();
      if (!text || !text.trim()) { flash(false); hideT = setTimeout(hide, 1000); return; }
      payload = { text, anchor: anchor || { exact: text, prefix: '', suffix: '' }, url: location.href, pageTitle: document.title || location.href };
    } else if (lastText.trim()) {
      payload = { text: lastText, anchor: { exact: lastText, prefix: '', suffix: '' }, url: location.href, pageTitle: document.title || location.href };
    } else {
      flash(false); hideT = setTimeout(hide, 1000); return;
    }

    try {
      const r = await send({ type: 'SAVE_HIGHLIGHT', payload });
      if (r && r.ok) {
        const ctx = (r.pageNote && r.highlight) ? { pn: r.pageNote.id, hl: r.highlight.id } : null;
        flash(true, ctx);
        if (r.highlight) paintHighlight(r.highlight);
        if (withComment && ctx) {
          openComment();
        } else {
          hideT = setTimeout(hide, 1200);
        }
      } else {
        flash(false); hideT = setTimeout(hide, 1000);
      }
    } catch (err) {
      console.error('Offline Notes: capture failed', err);
      if (!isCtxOk()) { const l = root?.getElementById('lbl'); if (l) l.textContent = 'Reload page'; }
      flash(false); hideT = setTimeout(hide, 2000);
    }
  }

  // ---- Messages from SW ----

  chrome.runtime.onMessage.addListener((msg, _, sr) => {
    if (!msg) return;
    if (msg.type === 'CAPTURE_FROM_SHORTCUT') { doCapture(false); sr({ ok: true }); return true; }
    if (msg.type === 'CAPTURE_FROM_CONTEXT_MENU') { doCapture(false); sr({ ok: true }); return true; }
    if (msg.type === 'SCROLL_TO_HIGHLIGHT') { scrollTo(msg.highlightId); sr({ ok: true }); return true; }
  });

  // ---- Re-paint ----

  function paintHighlight(h) {
    if (!h || !h.anchor) return false;
    if (document.querySelector(`mark.${MARK_CLASS}[data-highlight-id="${h.id}"]`)) return true;
    const range = window.Anchor.resolveAnchor(h.anchor, document.body);
    return range ? wrapRange(range, h.id) : false;
  }

  function wrapRange(range, id) {
    try {
      if (range.collapsed) return false;
      const nodes = textNodesIn(range);
      if (!nodes.length) return false;
      for (const { node, start, end } of nodes) {
        if (end < node.data.length) node.splitText(end);
        const mid = start > 0 ? node.splitText(start) : node;
        const m = document.createElement('mark');
        m.className = MARK_CLASS;
        m.setAttribute('data-highlight-id', id);
        mid.parentNode.insertBefore(m, mid);
        m.appendChild(mid);
      }
      return true;
    } catch (e) { return false; }
  }

  function textNodesIn(range) {
    const out = [];
    const root = range.commonAncestorContainer;
    const w = document.createTreeWalker(root.nodeType === 1 ? root : root.parentNode, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = w.nextNode())) {
      if (!range.intersectsNode(n)) continue;
      const p = n.parentElement;
      if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'NOSCRIPT') continue;
      let s = 0, e = n.data.length;
      if (n === range.startContainer) s = range.startOffset;
      if (n === range.endContainer) e = range.endOffset;
      if (e > s) out.push({ node: n, start: s, end: e });
    }
    return out;
  }

  // Repaint used to run exactly once, at document_idle. On any site that
  // renders its article after that (most React/Next/SPA article pages do)
  // every saved highlight silently failed to appear: the anchor resolved fine,
  // the text just was not in the DOM yet. So unresolved highlights are retried
  // as the page mutates, for a bounded window.
  const LATE_RENDER_WINDOW_MS = 15000;
  let lateObserver = null, lateTimer = null, lateDebounce = null;

  function stopWatchingForContent() {
    if (lateObserver) { lateObserver.disconnect(); lateObserver = null; }
    clearTimeout(lateTimer); lateTimer = null;
    clearTimeout(lateDebounce); lateDebounce = null;
  }

  function watchForLateContent(unresolved) {
    stopWatchingForContent();
    if (!unresolved.length || !document.body) return;
    let remaining = unresolved.slice();
    const attempt = () => {
      remaining = remaining.filter(h => !paintHighlight(h));
      if (!remaining.length) stopWatchingForContent();
    };
    lateObserver = new MutationObserver(() => {
      clearTimeout(lateDebounce);
      lateDebounce = setTimeout(attempt, 150);
    });
    lateObserver.observe(document.body, { childList: true, subtree: true });
    // Give up eventually rather than observing the document forever.
    lateTimer = setTimeout(stopWatchingForContent, LATE_RENDER_WINDOW_MS);
  }

  async function repaint() {
    try {
      const r = await send({ type: 'GET_PAGE_NOTE_WITH_SCROLL', url: location.href });
      const note = r && r.pageNote;
      const highlights = (note && note.highlights) || [];
      const unresolved = highlights.filter(h => !paintHighlight(h));
      if (r && r.pendingScroll) scrollTo(r.pendingScroll.highlightId);
      watchForLateContent(unresolved);
      showPresence(note, highlights.length, highlights.length - unresolved.length);
    } catch (e) { if (isCtxOk()) console.error('Offline Notes: repaint failed', e); }
  }

  // ---- Presence pill ----
  //
  // A page you have highlighted before should say so. The count is honest
  // about how many of the saved quotes this page can actually show, because a
  // badge reading 5 over a page displaying none is worse than no badge.

  let pill = null, pillRoot = null, pillDismissed = false, pillIndex = -1;

  function showPresence(note, total, locatedCount) {
    if (pillDismissed) return;
    if (!total) { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) buildPill();
    const label = pillRoot.getElementById('pl');
    label.textContent = locatedCount === total
      ? `${total} highlight${total === 1 ? '' : 's'}`
      : `${total} highlights · ${locatedCount} on this page`;
    pillRoot.getElementById('nav').style.display = locatedCount > 1 ? 'inline-flex' : 'none';
  }

  function buildPill() {
    pill = document.createElement('offline-notes-presence');
    pill.style.cssText = 'all:initial;position:fixed;z-index:2147483646;bottom:16px;right:16px;';
    pillRoot = pill.attachShadow({ mode: 'open' });
    pillRoot.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .p{display:inline-flex;align-items:center;gap:2px;background:#FAF7F2;border:1px solid #D8D0BF;border-radius:999px;box-shadow:0 2px 10px rgba(42,38,34,.14);font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2A2622;padding:3px 4px}
        .b{border:none;background:transparent;font:inherit;color:inherit;cursor:pointer;padding:5px 8px;border-radius:999px}
        .b:hover{background:#EAE4D8}
        #nav{display:inline-flex}
        .x{color:#8A8275}
      </style>
      <div class="p">
        <button class="b" id="pl" title="Open these highlights in the sidebar"></button>
        <span id="nav">
          <button class="b" id="prev" title="Previous highlight" aria-label="Previous highlight">‹</button>
          <button class="b" id="next" title="Next highlight" aria-label="Next highlight">›</button>
        </span>
        <button class="b x" id="hide" title="Hide for this page" aria-label="Hide">×</button>
      </div>`;
    document.body.appendChild(pill);
    pillRoot.getElementById('pl').addEventListener('click', () => send({ type: 'OPEN_SIDEBAR' }).catch(() => {}));
    pillRoot.getElementById('prev').addEventListener('click', () => stepHighlight(-1));
    pillRoot.getElementById('next').addEventListener('click', () => stepHighlight(1));
    pillRoot.getElementById('hide').addEventListener('click', () => {
      // Hides the indicator only. Nothing stored is touched, and the marks stay.
      pillDismissed = true; pill.remove(); pill = null;
    });
  }

  // Jumping is explicit. An ordinary revisit never moves the page.
  function stepHighlight(delta) {
    const marks = [...document.querySelectorAll(`mark.${MARK_CLASS}`)];
    if (!marks.length) return;
    pillIndex = (pillIndex + delta + marks.length) % marks.length;
    const m = marks[pillIndex];
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
    m.classList.add(FLASH_CLASS);
    setTimeout(() => m.classList.remove(FLASH_CLASS), 1600);
  }

  // Page notes are keyed by URL, and an SPA changes URL without a reload, so
  // without this the highlights for the newly shown article never load.
  let lastHref = location.href;
  function onUrlMaybeChanged() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    stopWatchingForContent();
    repaint();
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const out = original.apply(this, args);
      setTimeout(onUrlMaybeChanged, 0);
      return out;
    };
  }
  window.addEventListener('popstate', () => setTimeout(onUrlMaybeChanged, 0));

  function scrollTo(hlId) {
    const m = document.querySelector(`mark.${MARK_CLASS}[data-highlight-id="${hlId}"]`);
    if (!m) return;
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
    m.classList.add(FLASH_CLASS);
    setTimeout(() => m.classList.remove(FLASH_CLASS), 1600);
  }

  requestAnimationFrame(() => repaint());
})();
