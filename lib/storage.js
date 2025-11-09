/**
 * Local Storage Manager for Offline Notes
 * All data stored in chrome.storage.local - no internet required
 */

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
      return [];
    }
  }

  /**
   * Save a new note
   */
  async saveNote(note) {
    try {
      const notes = await this.getAllNotes();
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
  async updateNote(id, updates) {
    try {
      const notes = await this.getAllNotes();
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
  async deleteNote(id) {
    try {
      const notes = await this.getAllNotes();
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
  async saveSettings(settings) {
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
      return {
        notes,
        settings,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Import data (from backup)
   */
  async importData(data) {
    try {
      if (data.notes) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: data.notes });
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
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
