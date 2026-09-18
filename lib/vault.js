/*
 * Offline Notes — vault writer.
 *
 * Mirrors notes and page notes into a folder the user picks on disk, as plain
 * Markdown, so captures are readable by Obsidian, Spotlight, grep and git
 * without the extension in the loop.
 *
 * Deliberately minimal, and the limits are the design, not omissions:
 *   - Write only. Files on disk are never read back, so edits made to a
 *     generated file in another editor are replaced on the next write.
 *     Personal synthesis belongs in your own notes, linking to these records.
 *   - Flat. One folder, no subfolders, no vault organisation.
 *   - No deletes. Removing a capture in the extension leaves its file alone;
 *     deleting a durable file is the user's call, not ours.
 *   - No conflict resolution, no sync engine, no device reconciliation.
 *
 * Filenames are derived from record ids, not titles, so renaming a note does
 * not orphan its file. The human-readable title lives in the frontmatter.
 *
 * Nothing here transmits anything. If the chosen folder is managed by Obsidian
 * Sync, Dropbox or similar, that software may sync it; the extension does not.
 */
class VaultWriter {
  constructor() {
    this.DB_NAME = 'offline_notes_vault';
    this.STORE = 'handles';
    this.HANDLE_KEY = 'directory';
    this.handle = null;
  }

  // File System Access handles cannot go in chrome.storage (not JSON), but they
  // are structured-cloneable, so IndexedDB keeps them across restarts.
  _db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _idb(mode, fn) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, mode);
      const req = fn(tx.objectStore(this.STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  isSupported() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  async loadHandle() {
    if (this.handle) return this.handle;
    try {
      this.handle = (await this._idb('readonly', (s) => s.get(this.HANDLE_KEY))) || null;
    } catch (err) {
      console.error('VaultWriter.loadHandle failed:', err);
      this.handle = null;
    }
    return this.handle;
  }

  // 'none' = never connected, 'granted' = ready to write, 'prompt' = folder is
  // remembered but Chrome dropped permission and needs a click to restore it.
  async status() {
    const handle = await this.loadHandle();
    if (!handle) return { state: 'none', name: null };
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return { state: perm === 'granted' ? 'granted' : 'prompt', name: handle.name };
  }

  // Must be called from a user gesture; the picker and permission prompt both
  // require one.
  async connect() {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error('Write permission was not granted');
    this.handle = handle;
    await this._idb('readwrite', (s) => s.put(handle, this.HANDLE_KEY));
    return handle.name;
  }

  // Re-request on a remembered folder, also gesture-bound.
  async reconnect() {
    const handle = await this.loadHandle();
    if (!handle) throw new Error('No folder is remembered');
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error('Write permission was not granted');
    return handle.name;
  }

  // Forgets the folder. Files already written stay where they are.
  async disconnect() {
    this.handle = null;
    await this._idb('readwrite', (s) => s.delete(this.HANDLE_KEY));
  }

  async _write(filename, text) {
    const handle = await this.loadHandle();
    if (!handle) throw new Error('No vault folder connected');
    const file = await handle.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
    return filename;
  }

  // Ids are uuids or hex hashes; this is belt and braces against a stray
  // separator ever reaching a path.
  _safeId(id) {
    return String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'unknown';
  }

  noteFilename(note) { return `note-${this._safeId(note.id)}.md`; }
  pageNoteFilename(pageNote) { return `page-${this._safeId(pageNote.id)}.md`; }

  async writeNote(note, exporter) {
    return this._write(this.noteFilename(note), exporter.noteToMarkdown(note));
  }

  async writePageNote(pageNote, exporter) {
    return this._write(this.pageNoteFilename(pageNote), exporter.exportPageNote(pageNote, null));
  }

  /**
   * Mirror everything. Runs when the sidebar opens, which is the catch-up for
   * highlights captured while it was closed, and after changes while it is open.
   * Returns counts plus any per-record failures so the UI can stay honest about
   * what actually reached the disk.
   */
  async mirrorAll(notes, pageNotes, markdownExporter, pageExporter) {
    const result = { notes: 0, pageNotes: 0, errors: [] };
    const { state } = await this.status();
    if (state !== 'granted') return { ...result, skipped: state };
    for (const note of notes) {
      try { await this.writeNote(note, markdownExporter); result.notes++; }
      catch (err) { result.errors.push(`note ${note.id}: ${err.message}`); }
    }
    for (const pageNote of pageNotes) {
      try { await this.writePageNote(pageNote, pageExporter); result.pageNotes++; }
      catch (err) { result.errors.push(`page ${pageNote.id}: ${err.message}`); }
    }
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VaultWriter;
}
