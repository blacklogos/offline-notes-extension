/*
 * Offline Notes — in-page highlight capture + re-paint.
 *
 * Scope:
 *   - Selection bubble (Shadow DOM) with three entry points: bubble click,
 *     context menu via service worker, keyboard shortcut via service worker.
 *   - Serializes the current Range via Anchor.serializeAnchor and ships a
 *     SAVE_HIGHLIGHT message to the background.
 *   - On document_idle (this script's injection time), fetches the page note
 *     for the current URL via GET_PAGE_NOTE and re-paints stored highlights.
 *   - Consumes chrome.storage.session "pendingScroll" records to scroll and
 *     flash a specific <mark> after navigation from the sidebar.
 *
 * Runs on http(s) only (content_scripts match), with an extra scheme guard
 * for defense in depth.
 */

(() => {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (window.__offlineNotesHighlightLoaded) return;
  window.__offlineNotesHighlightLoaded = true;

  const BUBBLE_TAG = 'offline-notes-bubble';
  const MARK_CLASS = 'offline-notes-highlight';
  const FLASH_CLASS = 'offline-notes-flash';
  const SELECTION_DEBOUNCE_MS = 120;

  // ---- Bubble (Shadow DOM) ----

  let bubbleHost = null;
  let bubbleRoot = null;
  let bubbleButton = null;
  let bubbleLabel = null;
  let hideTimer = null;
  let lastSelectionText = '';

  function ensureBubble() {
    if (bubbleHost) return;
    bubbleHost = document.createElement(BUBBLE_TAG);
    bubbleHost.style.all = 'initial';
    bubbleHost.style.position = 'absolute';
    bubbleHost.style.zIndex = '2147483647';
    bubbleHost.style.top = '0';
    bubbleHost.style.left = '0';
    bubbleHost.style.pointerEvents = 'none';
    bubbleRoot = bubbleHost.attachShadow({ mode: 'open' });

    bubbleRoot.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          position: fixed;
          pointer-events: auto;
          opacity: 0;
          transform: translateY(2px);
          transition: opacity 120ms cubic-bezier(0.16,1,0.3,1),
                      transform 120ms cubic-bezier(0.16,1,0.3,1);
        }
        .wrap.visible { opacity: 1; transform: translateY(0); }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #FAF7F2;
          color: #2A2622;
          border: 1px solid #D8D0BF;
          border-radius: 8px;
          box-shadow: 0 2px 12px rgba(42, 38, 34, 0.15);
          font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          cursor: pointer;
          user-select: none;
          transition: background 120ms ease-out, color 120ms ease-out, border-color 120ms ease-out;
        }
        .pill:hover { background: #F5F1EA; border-color: #A8BBA8; }
        .pill .ico { display: inline-flex; width: 14px; height: 14px; color: #7C9885; }
        .pill .ico svg { width: 100%; height: 100%; }
        .pill.saved { color: #5F7A6A; border-color: #A8BBA8; background: #F5F1EA; }
        .pill.saved .ico { color: #5F7A6A; }
        .pill.failed { color: #8A4A3E; border-color: #D8B0A8; background: #F5EAE4; }
      </style>
      <div class="wrap" role="presentation">
        <button class="pill" type="button" aria-label="Save highlight">
          <span class="ico" id="ico"></span>
          <span id="label">Save</span>
        </button>
      </div>
    `;
    document.body.appendChild(bubbleHost);

    const wrap = bubbleRoot.querySelector('.wrap');
    bubbleButton = bubbleRoot.querySelector('.pill');
    bubbleLabel = bubbleRoot.querySelector('#label');
    bubbleRoot.getElementById('ico').innerHTML = window.Icons?.sparkle || '';

    bubbleButton.addEventListener('mousedown', (e) => {
      // Prevent selection loss when clicking the bubble.
      e.preventDefault();
    });
    bubbleButton.addEventListener('click', (e) => {
      e.preventDefault();
      captureCurrentSelection({ fallbackText: lastSelectionText });
    });

    bubbleHost._wrap = wrap;
  }

  function positionBubble(rect) {
    ensureBubble();
    const wrap = bubbleHost._wrap;
    // Position above the selection; fall back below if the top is out of view.
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    let top = rect.top + scrollY - 42;
    let left = rect.left + scrollX + rect.width / 2 - 40;
    if (rect.top < 44) top = rect.bottom + scrollY + 8;
    left = Math.max(8 + scrollX, Math.min(left, window.innerWidth - 120 + scrollX));
    wrap.style.top = `${top}px`;
    wrap.style.left = `${left}px`;
  }

  function showBubble(rect) {
    ensureBubble();
    positionBubble(rect);
    const wrap = bubbleHost._wrap;
    wrap.classList.add('visible');
    bubbleButton.classList.remove('saved', 'failed');
    bubbleLabel.textContent = 'Save';
    bubbleRoot.getElementById('ico').innerHTML = window.Icons?.sparkle || '';
    clearTimeout(hideTimer);
  }

  function hideBubble() {
    if (!bubbleHost) return;
    bubbleHost._wrap.classList.remove('visible');
  }

  function flashBubbleResult(kind) {
    if (!bubbleHost) return;
    bubbleButton.classList.add(kind);
    bubbleLabel.textContent = kind === 'saved' ? 'Saved' : 'Failed';
    bubbleRoot.getElementById('ico').innerHTML = kind === 'saved'
      ? (window.Icons?.check || '')
      : (window.Icons?.x || '');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBubble, 1200);
  }

  // ---- Selection tracking ----

  let selectionDebounce = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionDebounce);
    selectionDebounce = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideBubble();
        return;
      }
      const text = sel.toString();
      if (!text || !text.trim()) { hideBubble(); return; }
      // Ignore selection inside our own bubble (shouldn't happen but defend).
      const anchorNode = sel.anchorNode;
      if (anchorNode && anchorNode.nodeType === Node.ELEMENT_NODE
          && anchorNode.closest && anchorNode.closest(BUBBLE_TAG)) return;
      lastSelectionText = text;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      showBubble(rect);
    }, SELECTION_DEBOUNCE_MS);
  });

  // Hide bubble when the user clicks elsewhere (outside the bubble).
  document.addEventListener('mousedown', (e) => {
    if (!bubbleHost) return;
    if (e.composedPath && e.composedPath().includes(bubbleHost)) return;
    // Let the selectionchange handler decide — if the mousedown starts a new
    // selection, showBubble will fire; otherwise hide after a short delay so
    // the click has a chance to clear the selection first.
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) hideBubble();
    }, 10);
  });

  // ---- Capture + save ----

  function currentRange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0);
  }

  async function captureCurrentSelection(opts) {
    opts = opts || {};
    const range = currentRange();
    let payload;

    if (range) {
      const anchor = window.Anchor.serializeAnchor(range, document.body);
      const text = range.toString();
      if (!text || !text.trim()) {
        flashBubbleResult('failed');
        return;
      }
      payload = {
        text,
        anchor: anchor || { exact: text, prefix: '', suffix: '' },
        url: location.href,
        pageTitle: document.title || location.href,
      };
    } else if (opts.fallbackText && opts.fallbackText.trim()) {
      // Context-menu path where the selection may have been lost by the time
      // the message reaches us. Fall back to a text-only anchor.
      payload = {
        text: opts.fallbackText,
        anchor: { exact: opts.fallbackText, prefix: '', suffix: '' },
        url: location.href,
        pageTitle: document.title || location.href,
      };
    } else {
      flashBubbleResult('failed');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SAVE_HIGHLIGHT', payload });
      if (response && response.ok) {
        flashBubbleResult('saved');
        // Immediately re-paint the newly saved highlight in the existing DOM.
        if (response.highlight) {
          paintHighlight(response.highlight);
        }
      } else {
        flashBubbleResult('failed');
      }
    } catch (err) {
      console.error('Offline Notes: SAVE_HIGHLIGHT failed', err);
      flashBubbleResult('failed');
    }
  }

  // ---- Message listeners (from service worker) ----

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'CAPTURE_FROM_SHORTCUT') {
      captureCurrentSelection();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'CAPTURE_FROM_CONTEXT_MENU') {
      captureCurrentSelection({ fallbackText: msg.selectionText });
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'SCROLL_TO_HIGHLIGHT') {
      scrollToHighlight(msg.highlightId);
      sendResponse({ ok: true });
      return true;
    }
  });

  // ---- Re-paint on load ----

  function paintHighlight(highlight) {
    if (!highlight || !highlight.anchor) return false;
    // Skip if already painted (idempotent SPA / re-run).
    if (document.querySelector(`mark.${MARK_CLASS}[data-highlight-id="${highlight.id}"]`)) return true;
    const range = window.Anchor.resolveAnchor(highlight.anchor, document.body);
    if (!range) return false;
    return wrapRangeWithMark(range, highlight.id);
  }

  /**
   * Wrap a Range with <mark class="offline-notes-highlight" data-highlight-id="…">.
   * Handles ranges that span multiple text nodes by splitting them.
   */
  function wrapRangeWithMark(range, highlightId) {
    try {
      if (range.collapsed) return false;
      const textNodes = collectTextNodesInRange(range);
      if (textNodes.length === 0) return false;

      for (const { node, start, end } of textNodes) {
        // Split out the portion of the text node that's inside the range.
        if (end < node.data.length) node.splitText(end);
        const middle = start > 0 ? node.splitText(start) : node;
        const mark = document.createElement('mark');
        mark.className = MARK_CLASS;
        mark.setAttribute('data-highlight-id', highlightId);
        middle.parentNode.insertBefore(mark, middle);
        mark.appendChild(middle);
      }
      return true;
    } catch (err) {
      console.warn('Offline Notes: wrapRangeWithMark failed', err);
      return false;
    }
  }

  function collectTextNodesInRange(range) {
    const result = [];
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      root.nodeType === Node.ELEMENT_NODE ? root : root.parentNode,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (!range.intersectsNode(node)) continue;
      const p = node.parentElement;
      if (!p) continue;
      if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'NOSCRIPT') continue;
      let start = 0;
      let end = node.data.length;
      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;
      if (end > start) result.push({ node, start, end });
    }
    return result;
  }

  async function repaintAllForCurrentUrl() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_NOTE', url: location.href });
      const note = response && response.pageNote;
      if (!note || !note.highlights || note.highlights.length === 0) return;
      for (const h of note.highlights) paintHighlight(h);

      // Consume pendingScroll for this tab.
      const tabIdResponse = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
      const tabId = tabIdResponse && tabIdResponse.tabId;
      if (!tabId) return;
      const sessionData = await chrome.storage.session.get('pendingScroll');
      const pending = sessionData.pendingScroll;
      if (pending && pending.tabId === tabId && pending.highlightId) {
        scrollToHighlight(pending.highlightId);
        await chrome.storage.session.remove('pendingScroll');
      }
    } catch (err) {
      console.error('Offline Notes: repaint failed', err);
    }
  }

  function scrollToHighlight(highlightId) {
    const mark = document.querySelector(`mark.${MARK_CLASS}[data-highlight-id="${highlightId}"]`);
    if (!mark) return false;
    mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    mark.classList.add(FLASH_CLASS);
    setTimeout(() => mark.classList.remove(FLASH_CLASS), 1600);
    return true;
  }

  // Kick off re-paint after document_idle. Wrapped in rAF to give the page a
  // tick to settle.
  requestAnimationFrame(() => repaintAllForCurrentUrl());
})();
