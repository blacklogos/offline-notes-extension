// Initialize managers
const storage = new StorageManager();
const markdown = new MarkdownExporter();
const imageGen = new ImageGenerator();

// State
let allNotes = [];
let filteredNotes = [];
let selectedTag = null;
let currentNote = null;

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

  if (filteredNotes.length === 0) {
    emptyState.classList.remove('hidden');
    notesList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
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
});
