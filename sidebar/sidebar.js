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
  await applyFilters();
  renderTags();
}

// Single filter path. Query and tag always intersect, and a background storage
// refresh re-applies both instead of silently resetting the list to everything.
async function applyFilters() {
  const query = searchInput.value.trim();
  const base = query ? await storage.searchNotes(query) : allNotes;
  filteredNotes = selectedTag ? base.filter(note => note.tags.includes(selectedTag)) : base;
  renderNotes();
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
  await applyFilters();
  renderTags();
}

// Search notes
searchInput.addEventListener('input', () => { applyFilters(); });

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
// `force` skips the dirty check; used by the save and delete paths, which have
// already persisted (or discarded) the edits on purpose.
function isNoteDirty() {
  if (!currentNote) return false;
  return modalTitle.value !== currentNote.title
    || modalContent.value !== currentNote.content
    || modalTags.value !== currentNote.tags.join(', ');
}

function closeNoteModal(force) {
  if (!force && isNoteDirty() && !confirm('Discard unsaved changes to this note?')) return;
  noteModal.classList.add('hidden');
  currentNote = null;
}

// Wrapped: a bare listener would pass the click Event as `force` and skip the check.
closeModal.addEventListener('click', () => closeNoteModal());

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

    closeNoteModal(true);
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
      closeNoteModal(true);
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

// Export-all handler moved to bottom of file (context-aware: Notes tab vs Pages tab).

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

  // Ctrl/Cmd + F to focus search, but only when the search field is actually
  // visible. On the Pages tab it is hidden, so let the browser keep its find.
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && searchInput.offsetParent !== null) {
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
    loadPageNotes().then(() => {
      if (currentPageNote && !pageModal.classList.contains('hidden')) {
        // Don't rebuild the modal out from under an open comment editor or a
        // checkbox selection; the user would lose both without warning.
        const busy = pageHighlightsHost.querySelector('textarea.comment-edit')
          || pageHighlightsHost.querySelector('.hl-checkbox:checked');
        if (busy) return;
        pageStorage.getById(currentPageNote.id).then((fresh) => {
          if (fresh) { currentPageNote = fresh; openPageModal(fresh); }
        });
      }
    });
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

    const commentText = h.comment || '';
    const commentHtml = commentText
      ? `<div class="highlight-comment" data-hl-id="${h.id}">${escapeHtml(commentText)}</div>`
      : `<div class="highlight-comment placeholder" data-hl-id="${h.id}">Add a note…</div>`;

    card.innerHTML = `
      <label class="hl-check-label"><input type="checkbox" class="hl-checkbox" value="${h.id}"></label>
      <div class="highlight-body">
        <div class="highlight-text">${escapeHtml(h.text)}</div>
        ${commentHtml}
        <div class="highlight-actions">
          <span class="highlight-time">${relativeTime(h.capturedAt)}</span>
          <button class="icon-btn act-copy" title="Copy as markdown quote" data-icon="copy"></button>
          <button class="icon-btn act-jump" title="Open page and jump to this highlight" data-icon="chevronRight"></button>
          <button class="icon-btn act-delete" title="Delete this highlight" data-icon="trash"></button>
        </div>
      </div>
    `;
    card.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (Icons[name]) el.innerHTML = Icons[name];
    });
    card.querySelector('.act-copy').onclick = () => copyHighlightAsQuote(h, note);
    card.querySelector('.act-jump').onclick = () => jumpToHighlight(h, note);
    card.querySelector('.act-delete').onclick = () => deleteHighlight(h, note);

    // Inline-edit comment on click.
    const commentDiv = card.querySelector('.highlight-comment');
    commentDiv.addEventListener('click', () => {
      startCommentEdit(commentDiv, h, note);
    });

    // Checkbox change → update select-all state.
    card.querySelector('.hl-checkbox').addEventListener('change', updateSelectAllState);

    pageHighlightsHost.appendChild(card);
  });
  updateSelectAllState();
}

function startCommentEdit(el, highlight, pageNote) {
  if (el.querySelector('textarea')) return;
  const original = highlight.comment || '';
  el.textContent = '';
  el.classList.remove('placeholder');

  const ta = document.createElement('textarea');
  ta.className = 'comment-edit';
  ta.value = original;
  ta.placeholder = 'Add a note…';
  ta.rows = 2;
  ta.maxLength = 280;
  el.appendChild(ta);

  const counter = document.createElement('div');
  counter.className = 'comment-counter';
  counter.textContent = `${280 - original.length}`;
  el.appendChild(counter);

  ta.focus();

  ta.addEventListener('input', () => {
    counter.textContent = `${280 - ta.value.length}`;
  });

  const save = async () => {
    const text = ta.value.trim().slice(0, 280);
    ta.removeEventListener('blur', onBlur);
    if (text !== original) {
      highlight.comment = text;
      await chrome.runtime.sendMessage({
        type: 'UPDATE_HIGHLIGHT_COMMENT',
        pageNoteId: pageNote.id,
        highlightId: highlight.id,
        comment: text,
      });
    }
    el.textContent = text || '';
    if (!text) { el.textContent = 'Add a note…'; el.classList.add('placeholder'); }
  };
  const onBlur = () => save();
  ta.addEventListener('blur', onBlur);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.blur(); }
    if (e.key === 'Escape') { ta.value = original; ta.blur(); }
  });
}

function getSelectedHighlightIds() {
  const checked = pageHighlightsHost.querySelectorAll('.hl-checkbox:checked');
  if (checked.length === 0) return null; // null = all
  return Array.from(checked).map((cb) => cb.value);
}

function updateSelectAllState() {
  const all = pageHighlightsHost.querySelectorAll('.hl-checkbox');
  const checked = pageHighlightsHost.querySelectorAll('.hl-checkbox:checked');
  const selectAllCb = document.getElementById('selectAllHighlights');
  if (!selectAllCb) return;
  selectAllCb.checked = all.length > 0 && checked.length === all.length;
  selectAllCb.indeterminate = checked.length > 0 && checked.length < all.length;
}

// Wired from sidebar.html inline — see the select-all checkbox.
function toggleSelectAll(checked) {
  pageHighlightsHost.querySelectorAll('.hl-checkbox').forEach((cb) => { cb.checked = checked; });
  updateSelectAllState();
}

document.getElementById('selectAllHighlights')?.addEventListener('change', function () {
  toggleSelectAll(this.checked);
});

async function copyHighlightAsQuote(h, note) {
  let md = `> ${h.text.replace(/\n/g, '\n> ')}`;
  if (h.comment) md += `\n>\n> *${h.comment.replace(/\n/g, ' ')}*`;
  md += `\n>\n> — [${note.pageTitle}](${note.url})`;
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

// ---- Export wiring ----

const pageNoteExporter = new PageNoteExporter();

document.getElementById('exportPageMd')?.addEventListener('click', () => {
  if (!currentPageNote) return;
  const ids = getSelectedHighlightIds();
  const md = pageNoteExporter.exportPageNote(currentPageNote, ids);
  const fname = pageNoteExporter.sanitizeFilename(currentPageNote.pageTitle);
  pageNoteExporter.downloadMarkdown(md, fname);
});

document.getElementById('copyPageMd')?.addEventListener('click', async () => {
  if (!currentPageNote) return;
  const ids = getSelectedHighlightIds();
  const md = pageNoteExporter.exportPageNote(currentPageNote, ids);
  try {
    await pageNoteExporter.copyToClipboard(md);
    flashPageMetadata('Copied to clipboard');
  } catch (_) {
    flashPageMetadata('Copy failed');
  }
});

// Header export button: context-aware (Notes tab → manual notes; Pages tab → all page notes).
exportAllMd.addEventListener('click', async () => {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'pages') {
    if (allPageNotes.length === 0) { alert('No page notes to export'); return; }
    const md = pageNoteExporter.exportAllPageNotes(allPageNotes);
    pageNoteExporter.downloadMarkdown(md, 'offline-notes-all-pages');
  } else {
    const notes = await storage.getAllNotes();
    if (notes.length === 0) { alert('No notes to export'); return; }
    markdown.downloadAllNotes(notes);
  }
}, { once: false });

// Initial load (in addition to the lazy load on tab switch).
loadPageNotes();
