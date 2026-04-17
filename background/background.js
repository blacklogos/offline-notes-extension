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
    });
  } catch (err) {
    console.error('contextMenus.create failed:', err);
  }
});

// ---- Keyboard shortcuts ----

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
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
  if (info.menuItemId !== 'save-highlight' || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: 'CAPTURE_FROM_CONTEXT_MENU',
    selectionText: info.selectionText || '',
  });
});

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
