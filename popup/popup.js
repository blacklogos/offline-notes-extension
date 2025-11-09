// Initialize storage manager
const storage = new StorageManager();

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

// Auto-focus title field
noteTitle.focus();

// Handle form submission
noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title && !content) {
    noteTitle.focus();
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
      title: title || 'Untitled',
      content,
      tags
    });

    // Show success message
    successMessage.classList.remove('hidden');
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 2000);

    // Clear form
    noteTitle.value = '';
    noteContent.value = '';
    tagInput.value = '';
    noteTitle.focus();

    // Update count
    updateNoteCount();
  } catch (error) {
    alert('Error saving note: ' + error.message);
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  noteTitle.value = '';
  noteContent.value = '';
  tagInput.value = '';
  noteTitle.focus();
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
let autoSaveTimeout;
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

// Clear draft when note is saved
noteForm.addEventListener('submit', () => {
  chrome.storage.local.remove('draft_note');
});
