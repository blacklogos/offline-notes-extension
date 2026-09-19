/*
 * Offline Notes — theme switch.
 *
 * Two themes: the default warm-paper notebook, and "reader", an editorial
 * white-and-serif surface. The palette lives entirely in lib/tokens.css under
 * :root[data-theme="reader"], so this file only decides which attribute is on
 * <html> and remembers the choice.
 *
 * Stored under its own chrome.storage.local key rather than inside settings,
 * so it can be read and applied before anything else renders and cannot be
 * clobbered by an unrelated settings write.
 */
const THEME_KEY = 'offline_notes_theme';
const THEMES = ['paper', 'reader'];

async function getTheme() {
  try {
    const r = await chrome.storage.local.get(THEME_KEY);
    return THEMES.includes(r[THEME_KEY]) ? r[THEME_KEY] : 'paper';
  } catch (_) {
    return 'paper';
  }
}

function paintTheme(theme) {
  // Paper is the default and declares no attribute, so removing it is the
  // reset rather than a second competing selector.
  if (theme === 'reader') document.documentElement.setAttribute('data-theme', 'reader');
  else document.documentElement.removeAttribute('data-theme');
}

async function applyStoredTheme() {
  paintTheme(await getTheme());
}

async function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : 'paper';
  paintTheme(next);
  try { await chrome.storage.local.set({ [THEME_KEY]: next }); } catch (_) {}
  return next;
}

// Keep every open surface in step: switching in the sidebar repaints the popup
// the next time it opens, and any surface open right now follows immediately.
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, ns) => {
    if (ns === 'local' && changes[THEME_KEY]) paintTheme(changes[THEME_KEY].newValue);
  });
}
