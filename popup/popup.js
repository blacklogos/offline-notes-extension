// Inject vendored Lucide icons into any [data-icon] placeholder.
document.querySelectorAll('[data-icon]').forEach((el) => {
  const name = el.dataset.icon;
  if (Icons[name]) el.innerHTML = Icons[name];
});

// Paint the stored theme before anything else renders.
applyStoredTheme();

// Initialize storage manager
const storage = new StorageManager();

// Pending autosave timer. Declared up here because the save and clear paths both
// cancel it before removing the draft.
let autoSaveTimeout;

// DOM elements
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const tagInput = document.getElementById('tagInput');
const clearBtn = document.getElementById('clearBtn');
const openSidebar = document.getElementById('openSidebar');
const successMessage = document.getElementById('successMessage');
const noteCount = document.getElementById('noteCount');

// Load note count on startup
async function updateNoteCount() {
  const notes = await storage.getAllNotes();
  noteCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
}

// Initialize
updateNoteCount();

// Auto-focus the body: capture starts with the thought, not the filing.
noteContent.focus();


// A blank title used to save as "Untitled", making every body-only note
// indistinguishable in the list. Fall back to the first meaningful line instead.
function deriveTitle(content) {
  const line = content.split('\n').map(l => l.trim()).find(Boolean) || '';
  const clean = line.replace(/^#{1,6}\s*/, '').replace(/^[-*+]\s+/, '').trim();
  if (!clean) return 'Untitled';
  return clean.length > 60 ? clean.slice(0, 60).trimEnd() + '…' : clean;
}

// Handle form submission
noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title && !content) {
    noteContent.focus();
    return;
  }

  // Parse tags
  const tags = tagInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  try {
    // Save note
    await storage.saveNote({
      title: title || deriveTitle(content),
      content,
      tags
    });

    // Show success message
    successMessage.classList.remove('hidden');
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 2000);

    // Clear form
    clearTimeout(autoSaveTimeout);
    await chrome.storage.local.remove('draft_note');
    noteTitle.value = '';
    noteContent.value = '';
    tagInput.value = '';
    noteContent.focus();

    // Update count
    updateNoteCount();
  } catch (error) {
    alert('Error saving note: ' + error.message);
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  clearTimeout(autoSaveTimeout);
  chrome.storage.local.remove('draft_note');
  noteTitle.value = '';
  noteContent.value = '';
  tagInput.value = '';
  noteContent.focus();
});

// Open sidebar
openSidebar.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (error) {
    console.error('Error opening sidebar:', error);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    noteForm.dispatchEvent(new Event('submit'));
  }

  // Ctrl/Cmd + K to clear
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    clearBtn.click();
  }

  // Esc to close popup
  if (e.key === 'Escape') {
    window.close();
  }
});

// Auto-save to prevent data loss (save to temporary storage)
const autoSave = () => {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    const draft = {
      title: noteTitle.value,
      content: noteContent.value,
      tags: tagInput.value
    };
    chrome.storage.local.set({ 'draft_note': draft });
  }, 1000);
};

noteTitle.addEventListener('input', autoSave);
noteContent.addEventListener('input', autoSave);
tagInput.addEventListener('input', autoSave);

// Restore draft on load
chrome.storage.local.get('draft_note', (result) => {
  if (result.draft_note) {
    const draft = result.draft_note;
    // Only restore if fields are empty
    if (!noteTitle.value && draft.title) {
      noteTitle.value = draft.title;
    }
    if (!noteContent.value && draft.content) {
      noteContent.value = draft.content;
    }
    if (!tagInput.value && draft.tags) {
      tagInput.value = draft.tags;
    }
  }
});


// ---- Current page context ----
//
// The reader's main entry point. A page whose article is already saved offers
// "Read offline"; one that is not offers "Save & read", which captures the
// article and opens it in one step. Neither steals focus from the composer.

const pageContext = document.getElementById('pageContext');
const pageContextTitle = document.getElementById('pageContextTitle');
const pageContextMeta = document.getElementById('pageContextMeta');
const pageReadBtn = document.getElementById('pageRead');
const pageSaveReadBtn = document.getElementById('pageSaveRead');

let contextNote = null;

async function loadPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Only http(s) pages can be captured; extension and settings pages cannot.
    if (!tab || !/^https?:/.test(tab.url || '')) return;

    const res = await chrome.runtime.sendMessage({ type: 'GET_PAGE_NOTE', url: tab.url });
    contextNote = (res && res.pageNote) || null;
    pageContextTitle.textContent = (contextNote && contextNote.pageTitle) || tab.title || tab.url;

    const count = contextNote ? contextNote.highlights.length : 0;
    const saved = !!(contextNote && contextNote.savedContent);
    const bits = [];
    bits.push(count ? `${count} highlight${count === 1 ? '' : 's'}` : 'No highlights yet');
    if (saved) bits.push('article saved');
    pageContextMeta.textContent = bits.join(' · ');

    // "Read offline" only means something once there is an article to read.
    pageReadBtn.classList.toggle('hidden', !saved);
    pageSaveReadBtn.textContent = saved ? 'Update article' : 'Save & read';
    pageContext.classList.remove('hidden');
  } catch (err) {
    console.error('Page context failed:', err);
  }
}

pageReadBtn.addEventListener('click', async () => {
  if (!contextNote) return;
  await chrome.runtime.sendMessage({ type: 'OPEN_READER', pageNoteId: contextNote.id });
  window.close();
});

pageSaveReadBtn.addEventListener('click', async () => {
  pageSaveReadBtn.disabled = true;
  pageSaveReadBtn.textContent = 'Saving…';
  const res = await chrome.runtime.sendMessage({ type: 'SAVE_PAGE_CONTENT' });
  if (!res || !res.ok) {
    // Be explicit that the failure is about the article, not their highlights.
    pageContextMeta.textContent = (res && res.error) || 'Could not read this page';
    pageSaveReadBtn.disabled = false;
    pageSaveReadBtn.textContent = 'Save & read';
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const fresh = await chrome.runtime.sendMessage({ type: 'GET_PAGE_NOTE', url: tab.url });
  if (fresh && fresh.pageNote) {
    await chrome.runtime.sendMessage({ type: 'OPEN_READER', pageNoteId: fresh.pageNote.id });
    window.close();
  }
});

loadPageContext();
