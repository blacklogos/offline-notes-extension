// Inject vendored Lucide icons into any [data-icon] placeholder.
document.querySelectorAll('[data-icon]').forEach((el) => {
  const name = el.dataset.icon;
  if (Icons[name]) el.innerHTML = Icons[name];
});

// Initialize managers
const storage = new StorageManager();
const markdown = new MarkdownExporter();
const imageGen = new ImageGenerator();
const pageStorage = new PageNoteStorage();

// State
let allNotes = [];
let filteredNotes = [];
let selectedTag = null;
let currentNote = null;
let allPageNotes = [];
let currentPageNote = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const tagFilter = document.getElementById('tagFilter');
const notesList = document.getElementById('notesList');
const emptyState = document.getElementById('emptyState');
const noteModal = document.getElementById('noteModal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalTags = document.getElementById('modalTags');
const closeModal = document.getElementById('closeModal');
const saveNote = document.getElementById('saveNote');
const deleteNote = document.getElementById('deleteNote');
const exportMd = document.getElementById('exportMd');
const generateImage = document.getElementById('generateImage');
const templateSelect = document.getElementById('templateSelect');
const exportAllMd = document.getElementById('exportAllMd');
const noteMetadata = document.getElementById('noteMetadata');

// Initialize
loadNotes();

// Load all notes
async function loadNotes() {
  allNotes = await storage.getAllNotes();
  filteredNotes = allNotes;
  renderNotes();
  renderTags();
}

// Render notes list
function renderNotes() {
  notesList.innerHTML = '';
  const searchEmptyState = document.getElementById('searchEmptyState');
  const searchEmptyText = document.getElementById('searchEmptyText');

  emptyState.classList.add('hidden');
  searchEmptyState.classList.add('hidden');
  notesList.classList.add('hidden');

  if (allNotes.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  if (filteredNotes.length === 0) {
    const q = searchInput.value.trim();
    searchEmptyText.textContent = q ? `Nothing matches “${q}”.` : 'Try clearing the tag filter.';
    searchEmptyState.classList.remove('hidden');
    return;
  }

  notesList.classList.remove('hidden');
  filteredNotes.forEach(note => {
    const card = createNoteCard(note);
    notesList.appendChild(card);
  });
}

// Create note card element
function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.onclick = () => openNoteModal(note);

  const header = document.createElement('div');
  header.className = 'note-card-header';

  const title = document.createElement('h3');
  title.className = 'note-card-title';
  title.textContent = note.title;

  const date = document.createElement('span');
  date.className = 'note-card-date';
  date.textContent = formatDate(note.updatedAt);

  header.appendChild(title);
  header.appendChild(date);

  const content = document.createElement('div');
  content.className = 'note-card-content';
  content.textContent = note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '');

  card.appendChild(header);
  card.appendChild(content);

  if (note.tags && note.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'note-card-tags';

    note.tags.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'note-tag';
      tagEl.textContent = '#' + tag;
      tagsContainer.appendChild(tagEl);
    });

    card.appendChild(tagsContainer);
  }

  return card;
}

// Render tag filter
async function renderTags() {
  const tags = await storage.getAllTags();

  if (tags.length === 0) {
    tagFilter.classList.add('hidden');
    return;
  }

  tagFilter.classList.remove('hidden');
  tagFilter.innerHTML = '';

  // All notes chip
  const allChip = document.createElement('div');
  allChip.className = 'tag-chip' + (selectedTag === null ? ' active' : '');
  allChip.textContent = 'All';
  allChip.onclick = () => filterByTag(null);
  tagFilter.appendChild(allChip);

  // Tag chips
  tags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip' + (selectedTag === tag ? ' active' : '');
    chip.textContent = '#' + tag;
    chip.onclick = () => filterByTag(tag);
    tagFilter.appendChild(chip);
  });
}

// Filter notes by tag
async function filterByTag(tag) {
  selectedTag = tag;

  if (tag === null) {
    filteredNotes = allNotes;
  } else {
    filteredNotes = await storage.getNotesByTag(tag);
  }

  renderNotes();
  renderTags();
}

// Search notes
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim();

  if (query === '') {
    filteredNotes = selectedTag ? await storage.getNotesByTag(selectedTag) : allNotes;
  } else {
    const results = await storage.searchNotes(query);
    filteredNotes = selectedTag
      ? results.filter(note => note.tags.includes(selectedTag))
      : results;
  }

  renderNotes();
});

// Open note modal
function openNoteModal(note) {
  currentNote = note;
  modalTitle.value = note.title;
  modalContent.value = note.content;
  modalTags.value = note.tags.join(', ');
  noteMetadata.textContent = `Created: ${formatDate(note.createdAt)} • Updated: ${formatDate(note.updatedAt)}`;
  noteModal.classList.remove('hidden');
  modalTitle.focus();
}

// Close modal
function closeNoteModal() {
  noteModal.classList.add('hidden');
  currentNote = null;
}

closeModal.addEventListener('click', closeNoteModal);

// Click outside modal to close
noteModal.addEventListener('click', (e) => {
  if (e.target === noteModal) {
    closeNoteModal();
  }
});

// Save note
saveNote.addEventListener('click', async () => {
  if (!currentNote) return;

  const tags = modalTags.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  try {
    await storage.updateNote(currentNote.id, {
      title: modalTitle.value.trim() || 'Untitled',
      content: modalContent.value.trim(),
      tags
    });

    closeNoteModal();
    await loadNotes();
  } catch (error) {
    alert('Error saving note: ' + error.message);
  }
});

// Delete note
deleteNote.addEventListener('click', async () => {
  if (!currentNote) return;

  if (confirm('Are you sure you want to delete this note?')) {
    try {
      await storage.deleteNote(currentNote.id);
      closeNoteModal();
      await loadNotes();
    } catch (error) {
      alert('Error deleting note: ' + error.message);
    }
  }
});

// Export single note to Markdown
exportMd.addEventListener('click', () => {
  if (!currentNote) return;

  const note = {
    ...currentNote,
    title: modalTitle.value.trim() || 'Untitled',
    content: modalContent.value.trim(),
    tags: modalTags.value.split(',').map(t => t.trim()).filter(t => t)
  };

  markdown.downloadNote(note);
});

// Export all notes to Markdown
exportAllMd.addEventListener('click', async () => {
  const notes = await storage.getAllNotes();
  if (notes.length === 0) {
    alert('No notes to export');
    return;
  }
  markdown.downloadAllNotes(notes);
});

// Generate image from note
generateImage.addEventListener('click', async () => {
  if (!currentNote) return;

  const template = templateSelect.value;
  const note = {
    ...currentNote,
    title: modalTitle.value.trim() || 'Untitled',
    content: modalContent.value.trim(),
    tags: modalTags.value.split(',').map(t => t.trim()).filter(t => t)
  };

  try {
    // Show loading state
    generateImage.disabled = true;
    generateImage.textContent = 'Generating...';

    await imageGen.downloadImage(note, template, 'png');

    // Reset button
    generateImage.disabled = false;
    generateImage.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      Create Image
    `;
  } catch (error) {
    alert('Error generating image: ' + error.message);
    generateImage.disabled = false;
    generateImage.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      Create Image
    `;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Esc to close modal
  if (e.key === 'Escape' && !noteModal.classList.contains('hidden')) {
    closeNoteModal();
  }

  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && !noteModal.classList.contains('hidden')) {
    e.preventDefault();
    saveNote.click();
  }

  // Ctrl/Cmd + F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    searchInput.focus();
  }
});

// Format date helper
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Auto-refresh notes when storage changes (from popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.offline_notes) {
    loadNotes();
  }
  if (namespace === 'local' && changes.offline_page_notes) {
    loadPageNotes();
  }
});

// ==========================================================================
// Tab strip (Notes / Pages)
// ==========================================================================

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const ACTIVE_TAB_KEY = 'offline_notes_active_tab';

async function initTabs() {
  const stored = await chrome.storage.local.get(ACTIVE_TAB_KEY);
  const active = stored[ACTIVE_TAB_KEY] || 'notes';
  switchTab(active);
}

function switchTab(name) {
  tabButtons.forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  tabPanels.forEach((panel) => {
    const on = panel.dataset.panel === name;
    panel.classList.toggle('active', on);
    if (on) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  });
  chrome.storage.local.set({ [ACTIVE_TAB_KEY]: name });
  if (name === 'pages') loadPageNotes();
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

initTabs();

// ==========================================================================
// Pages tab — list, empty state, detail modal, jump-to-highlight
// ==========================================================================

const pagesList = document.getElementById('pagesList');
const pagesEmptyState = document.getElementById('pagesEmptyState');
const pageModal = document.getElementById('pageModal');
const pageModalTitle = document.getElementById('pageModalTitle');
const pageSourceLink = document.getElementById('pageSourceLink');
const copyPageUrlBtn = document.getElementById('copyPageUrl');
const pageHighlightsHost = document.getElementById('pageHighlights');
const closePageModalBtn = document.getElementById('closePageModal');
const deletePageNoteBtn = document.getElementById('deletePageNote');
const pageMetadataEl = document.getElementById('pageMetadata');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function relativeTime(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; }
}

async function loadPageNotes() {
  allPageNotes = await pageStorage.getAll();
  renderPageNotes();
}

function renderPageNotes() {
  pagesList.innerHTML = '';
  if (allPageNotes.length === 0) {
    pagesEmptyState.classList.remove('hidden');
    pagesList.classList.add('hidden');
    return;
  }
  pagesEmptyState.classList.add('hidden');
  pagesList.classList.remove('hidden');

  allPageNotes.forEach((note) => {
    const row = document.createElement('div');
    row.className = 'page-row';
    row.innerHTML = `
      <div class="page-row-title">${escapeHtml(note.pageTitle)}</div>
      <div class="page-row-meta">
        <span class="host">${escapeHtml(hostOf(note.url))}</span>
        <span class="sep">·</span>
        <span class="count">${note.highlights.length} highlight${note.highlights.length === 1 ? '' : 's'}</span>
        <span class="sep">·</span>
        <span class="time">${relativeTime(note.updatedAt)}</span>
      </div>
    `;
    row.onclick = () => openPageModal(note);
    pagesList.appendChild(row);
  });
}

function openPageModal(note) {
  currentPageNote = note;
  pageModalTitle.value = note.pageTitle || '';
  pageSourceLink.textContent = note.url;
  pageSourceLink.href = note.url;
  pageMetadataEl.textContent = `${note.highlights.length} highlight${note.highlights.length === 1 ? '' : 's'} · Updated ${relativeTime(note.updatedAt)}`;
  renderHighlights(note);
  pageModal.classList.remove('hidden');
}

function closePageModal() {
  pageModal.classList.add('hidden');
  currentPageNote = null;
}

function renderHighlights(note) {
  pageHighlightsHost.innerHTML = '';
  note.highlights.slice().reverse().forEach((h) => {
    const card = document.createElement('div');
    card.className = 'highlight-card';
    card.dataset.highlightId = h.id;
    card.innerHTML = `
      <div class="highlight-text">${escapeHtml(h.text)}</div>
      <div class="highlight-actions">
        <span class="highlight-time">${relativeTime(h.capturedAt)}</span>
        <button class="icon-btn act-copy" title="Copy as markdown quote" data-icon="copy"></button>
        <button class="icon-btn act-jump" title="Open page and jump to this highlight" data-icon="chevronRight"></button>
        <button class="icon-btn act-delete" title="Delete this highlight" data-icon="trash"></button>
      </div>
    `;
    // Inject icons for the buttons we just created.
    card.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (Icons[name]) el.innerHTML = Icons[name];
    });
    card.querySelector('.act-copy').onclick = () => copyHighlightAsQuote(h, note);
    card.querySelector('.act-jump').onclick = () => jumpToHighlight(h, note);
    card.querySelector('.act-delete').onclick = () => deleteHighlight(h, note);
    pageHighlightsHost.appendChild(card);
  });
}

async function copyHighlightAsQuote(h, note) {
  const md = `> ${h.text.replace(/\n/g, '\n> ')}\n>\n> — [${note.pageTitle}](${note.url})`;
  try {
    await navigator.clipboard.writeText(md);
    flashPageMetadata('Copied as markdown quote');
  } catch (err) {
    flashPageMetadata('Copy failed');
  }
}

async function jumpToHighlight(h, note) {
  try {
    const tabs = await chrome.tabs.query({ url: note.url });
    let tabId;
    if (tabs && tabs.length > 0) {
      tabId = tabs[0].id;
      await chrome.tabs.update(tabId, { active: true });
      if (tabs[0].windowId) await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      const created = await chrome.tabs.create({ url: note.url, active: true });
      tabId = created.id;
    }
    // Stash a pending-scroll record keyed by tabId. The content script picks
    // it up on document_idle after the page has loaded (or is already loaded).
    await chrome.storage.session.set({ pendingScroll: { tabId, highlightId: h.id } });
    // Fast path: if the tab is already fully loaded, send a direct message.
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_TO_HIGHLIGHT', highlightId: h.id });
    } catch (_) { /* tab may still be loading; content script will pick up pendingScroll */ }
  } catch (err) {
    console.error('Jump to highlight failed:', err);
    flashPageMetadata('Could not open the page');
  }
}

async function deleteHighlight(h, note) {
  if (!confirm('Delete this highlight?')) return;
  await pageStorage.deleteHighlight(note.id, h.id);
  const refreshed = await pageStorage.getById(note.id);
  if (!refreshed || refreshed.highlights.length === 0) {
    closePageModal();
  } else {
    currentPageNote = refreshed;
    renderHighlights(refreshed);
    pageMetadataEl.textContent = `${refreshed.highlights.length} highlight${refreshed.highlights.length === 1 ? '' : 's'} · Updated ${relativeTime(refreshed.updatedAt)}`;
  }
  loadPageNotes();
}

async function deleteCurrentPageNote() {
  if (!currentPageNote) return;
  if (!confirm(`Delete the page note for "${currentPageNote.pageTitle}"? All ${currentPageNote.highlights.length} highlight(s) will be removed.`)) return;
  await pageStorage.deletePageNote(currentPageNote.id);
  closePageModal();
  loadPageNotes();
}

let pageMetaFlashTimer = null;
function flashPageMetadata(text) {
  const prev = pageMetadataEl.textContent;
  pageMetadataEl.textContent = text;
  clearTimeout(pageMetaFlashTimer);
  pageMetaFlashTimer = setTimeout(() => { pageMetadataEl.textContent = prev; }, 1800);
}

pageModalTitle.addEventListener('blur', async () => {
  if (!currentPageNote) return;
  const newTitle = pageModalTitle.value.trim() || currentPageNote.pageTitle;
  if (newTitle === currentPageNote.pageTitle) return;
  await pageStorage.updatePageTitle(currentPageNote.id, newTitle);
  currentPageNote.pageTitle = newTitle;
  loadPageNotes();
});

closePageModalBtn.addEventListener('click', closePageModal);
deletePageNoteBtn.addEventListener('click', deleteCurrentPageNote);
pageModal.addEventListener('click', (e) => {
  if (e.target === pageModal) closePageModal();
});

copyPageUrlBtn.addEventListener('click', async () => {
  if (!currentPageNote) return;
  try {
    await navigator.clipboard.writeText(currentPageNote.url);
    flashPageMetadata('URL copied');
  } catch (_) { flashPageMetadata('Copy failed'); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pageModal.classList.contains('hidden')) {
    closePageModal();
  }
});

// Initial load (in addition to the lazy load on tab switch).
loadPageNotes();
