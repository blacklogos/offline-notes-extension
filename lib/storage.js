/**
 * Local Storage Manager for Offline Notes
 * All data stored in chrome.storage.local - no internet required
 */

// Storage key owned by PageNoteStorage (lib/page-storage.js). Declared here so
// backup and restore can cover page notes without depending on load order.
const PAGE_NOTES_KEY = 'offline_page_notes';

class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'offline_notes';
    this.SETTINGS_KEY = 'offline_notes_settings';
  }

  /**
   * Get all notes
   */
  async getAllNotes() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Error getting notes:', error);
      // Deliberately not []: a mutation that read [] would write [] back and
      // erase every note. Callers that mutate use _readNotesForWrite.
      return [];
    }
  }

  /**
   * Read the collection for a read-modify-write. Unlike getAllNotes this
   * throws on failure, because the alternative is writing an empty collection
   * over the user's notes.
   */
  async _readNotesForWrite() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  /**
   * Save a new note
   */
  async _saveNote(note) {
    try {
      const notes = await this._readNotesForWrite();
      const newNote = {
        id: this.generateId(),
        title: note.title || 'Untitled',
        content: note.content || '',
        tags: note.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...note
      };
      notes.unshift(newNote);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: notes });
      return newNote;
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  /**
   * Update existing note
   */
  async _updateNote(id, updates) {
    try {
      const notes = await this._readNotesForWrite();
      const index = notes.findIndex(n => n.id === id);
      if (index === -1) throw new Error('Note not found');

      notes[index] = {
        ...notes[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await chrome.storage.local.set({ [this.STORAGE_KEY]: notes });
      return notes[index];
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async _deleteNote(id) {
    try {
      const notes = await this._readNotesForWrite();
      const filtered = notes.filter(n => n.id !== id);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Search notes
   */
  async searchNotes(query) {
    try {
      const notes = await this.getAllNotes();
      const lowerQuery = query.toLowerCase();
      return notes.filter(note =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Error searching notes:', error);
      return [];
    }
  }

  /**
   * Get notes by tag
   */
  async getNotesByTag(tag) {
    try {
      const notes = await this.getAllNotes();
      return notes.filter(note => note.tags.includes(tag));
    } catch (error) {
      console.error('Error getting notes by tag:', error);
      return [];
    }
  }

  /**
   * Get all unique tags
   */
  async getAllTags() {
    try {
      const notes = await this.getAllNotes();
      const tagsSet = new Set();
      notes.forEach(note => {
        note.tags.forEach(tag => tagsSet.add(tag));
      });
      return Array.from(tagsSet).sort();
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }

  /**
   * Get settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY);
      return result[this.SETTINGS_KEY] || {
        theme: 'light',
        defaultTemplate: 'default',
        fontSize: 'medium',
        autoSave: true
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  /**
   * Save settings
   */
  async _saveSettings(settings) {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await chrome.storage.local.set({ [this.SETTINGS_KEY]: updated });
      return updated;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export all data (for backup)
   */
  async exportAllData() {
    try {
      const notes = await this.getAllNotes();
      const settings = await this.getSettings();
      // Page notes live under their own key, owned by PageNoteStorage. A backup
      // that skipped them silently dropped every highlight and comment the user
      // had ever saved, which is most of the data in a highlight-first product.
      const pageResult = await chrome.storage.local.get(PAGE_NOTES_KEY);
      return {
        notes,
        pageNotes: pageResult[PAGE_NOTES_KEY] || {},
        settings,
        exportedAt: new Date().toISOString(),
        version: '1.1.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Import data (from backup)
   */
  async _importData(data) {
    try {
      if (data.notes) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: data.notes });
      }
      // Kept symmetric with exportAllData; a restore that ignored page notes
      // would quietly discard the highlights the backup does contain.
      if (data.pageNotes) {
        await chrome.storage.local.set({ [PAGE_NOTES_KEY]: data.pageNotes });
      }
      if (data.settings) {
        await chrome.storage.local.set({ [this.SETTINGS_KEY]: data.settings });
      }
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /*
   * Public mutations are serialized for the same reason as page notes:
   * each rewrites the whole notes array after reading it, so two running
   * at once both read the old array and the second discards the first.
   */
  async saveNote(note) {
    return noteWriteQueue.run(() => this._saveNote(note));
  }

  async updateNote(id, updates) {
    return noteWriteQueue.run(() => this._updateNote(id, updates));
  }

  async deleteNote(id) {
    return noteWriteQueue.run(() => this._deleteNote(id));
  }

  async importData(data) {
    return noteWriteQueue.run(() => this._importData(data));
  }

  async saveSettings(settings) {
    return noteWriteQueue.run(() => this._saveSettings(settings));
  }

}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
