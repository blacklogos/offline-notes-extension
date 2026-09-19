/*
 * Background service worker.
 *
 * Responsibilities:
 *   - Route command shortcuts (Alt+N, Alt+Shift+N, Alt+H).
 *   - Register the right-click "Save highlight to Offline Notes" context menu.
 *   - Message router for capture + re-paint messages from content scripts and
 *     sidebar.
 *   - Per-tab badge updates reflecting saved-highlight count for the current URL.
 *
 * Loaded as a classic service worker (not an ES module) so importScripts works
 * with the plain-global lib/ files that popup + sidebar also rely on.
 */

importScripts(
  '/lib/url-canonical.js',
  '/lib/page-storage.js',
);

const pageStorage = new PageNoteStorage();

// ---- Install ----

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Offline Notes Extension installed!');
  }
  // Register the selection context menu on every install/update. Chrome
  // deduplicates by id, so this is safe to run every time.
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'save-highlight',
        title: 'Save highlight to Offline Notes',
        contexts: ['selection'],
      });
      chrome.contextMenus.create({
        id: 'save-page',
        title: 'Save page text to Offline Notes',
        contexts: ['page'],
      });
    });
  } catch (err) {
    console.error('contextMenus.create failed:', err);
  }
});

// ---- Keyboard shortcuts ----

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'save-page': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await savePageContent(tab);
      break;
    }
    case 'quick-note':
      try { await chrome.action.openPopup(); } catch (err) { /* no active popup allowed; ignore */ }
      break;
    case 'open-sidebar':
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) { console.error('open-sidebar failed:', err); }
      break;
    case 'save-highlight':
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FROM_SHORTCUT' });
      } catch (err) { console.error('save-highlight failed:', err); }
      break;
  }
});

// ---- Context menu ----

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-page' && tab?.id) { savePageContent(tab); return; }
  if (info.menuItemId !== 'save-highlight' || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: 'CAPTURE_FROM_CONTEXT_MENU',
    selectionText: info.selectionText || '',
  });
});


// ---- Save readable page text ----

async function savePageContent(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url || '')) return { ok: false, error: 'Unsupported page' };
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/readability.js', 'lib/page-content.js'],
    });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__offlineNotesExtractArticle(),
    });
    if (!result) {
      await flashBadge(tab.id, '!');
      return { ok: false, error: 'No readable article found on this page' };
    }
    await pageStorage.setSavedContent(tab.url, result.title || tab.title, result);
    await flashBadge(tab.id, 'OK');
    updateBadgeForTab(tab.id, tab.url);
    return { ok: true, chars: result.chars };
  } catch (err) {
    console.error('savePageContent failed:', err);
    return { ok: false, error: err.message };
  }
}

// The page has no UI of its own for this action, so the toolbar badge is the
// only feedback channel. Restore the highlight count afterwards.
async function flashBadge(tabId, text) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => { chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}); }, 1500);
  } catch (_) {}
}

// ---- Message router ----

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'SAVE_HIGHLIGHT') {
    (async () => {
      try {
        const p = msg.payload || {};
        const highlight = {
          id: crypto.randomUUID(),
          text: p.text || '',
          anchor: p.anchor || { exact: p.text || '', prefix: '', suffix: '' },
          comment: p.comment || '',
          capturedAt: new Date().toISOString(),
        };
        const pageNote = await pageStorage.appendHighlight(p.url, p.pageTitle, highlight);
        if (sender.tab?.id) updateBadgeForTab(sender.tab.id, p.url);
        sendResponse({ ok: true, highlight, pageNote });
      } catch (err) {
        console.error('SAVE_HIGHLIGHT failed:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'UPDATE_HIGHLIGHT_COMMENT') {
    (async () => {
      try {
        const ok = await pageStorage.updateHighlightComment(msg.pageNoteId, msg.highlightId, msg.comment);
        sendResponse({ ok });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'SAVE_PAGE_CONTENT') {
    (async () => {
      // A content script knows which tab it is in; trust that over the active
      // tab, or a request from a background tab would save the wrong page.
      // The sidebar has no sender.tab, so it falls back to the active tab.
      let tab = sender.tab || null;
      if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse(tab ? await savePageContent(tab) : { ok: false, error: 'No active tab' });
    })();
    return true;
  }

  // Open (or focus) the reader for a saved page note.
  if (msg.type === 'OPEN_READER') {
    (async () => {
      try {
        const url = chrome.runtime.getURL(`reader/reader.html?page=${encodeURIComponent(msg.pageNoteId)}`);
        // Reuse a reader tab already showing this page note rather than
        // stacking duplicates every time the button is pressed.
        const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('reader/reader.html') + '*' });
        const match = existing.find((t) => t.url === url);
        if (match) {
          await chrome.tabs.update(match.id, { active: true });
          await chrome.windows.update(match.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url });
        }
        sendResponse({ ok: true });
      } catch (err) {
        console.error('OPEN_READER failed:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'OPEN_SIDEBAR') {
    (async () => {
      try {
        const win = sender.tab?.windowId ?? (await chrome.windows.getCurrent()).id;
        await chrome.sidePanel.open({ windowId: win });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_PAGE_NOTE') {
    (async () => {
      try {
        const note = await pageStorage.getByUrl(msg.url);
        sendResponse({ ok: true, pageNote: note });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_PAGE_NOTE_WITH_SCROLL') {
    (async () => {
      try {
        const note = await pageStorage.getByUrl(msg.url);
        let pendingScroll = null;
        const tabId = sender.tab?.id;
        if (tabId) {
          const sessionData = await chrome.storage.session.get('pendingScroll');
          const ps = sessionData.pendingScroll;
          if (ps && ps.tabId === tabId) {
            pendingScroll = ps;
            await chrome.storage.session.remove('pendingScroll');
          }
        }
        sendResponse({ ok: true, pageNote: note, pendingScroll });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_TAB_ID') {
    sendResponse({ ok: true, tabId: sender.tab?.id || null });
    return;
  }

  if (msg.type === 'REFRESH_BADGE') {
    if (sender.tab?.id) updateBadgeForTab(sender.tab.id, msg.url || sender.tab.url);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'ping') {
    sendResponse({ status: 'alive' });
    return;
  }
});

// ---- Badge updates ----

async function updateBadgeForTab(tabId, url) {
  try {
    if (!tabId) return;
    let count = 0;
    if (url && /^https?:/.test(url)) {
      count = await pageStorage.countForUrl(url);
    }
    await chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#7C9885' });
    if (chrome.action.setBadgeTextColor) {
      // Newer Chrome only.
      await chrome.action.setBadgeTextColor({ tabId, color: '#FAF7F2' });
    }
  } catch (err) {
    // Tab may have closed mid-update; ignore.
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    updateBadgeForTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url) updateBadgeForTab(tabId, tab.url);
  } catch (_) { /* tab gone */ }
});
