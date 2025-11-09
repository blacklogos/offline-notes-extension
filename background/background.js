/**
 * Background Service Worker
 * Handles keyboard shortcuts and basic extension management
 */

// Handle keyboard command shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'quick-note':
      // Open popup
      chrome.action.openPopup();
      break;

    case 'open-sidebar':
      // Open side panel - get current window first
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      } catch (err) {
        console.error('Error opening side panel:', err);
      }
      break;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  chrome.action.openPopup();
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Offline Notes Extension installed!');

    // Open sidebar on first install
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.error('Error opening side panel on install:', err);
    }
  }
});

// Keep service worker alive (if needed)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ping') {
    sendResponse({ status: 'alive' });
  }
  return true;
});
