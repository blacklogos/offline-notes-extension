/*
 * Offline Notes — backup and restore.
 *
 * The product's promise is that your data is yours, which is only true if you
 * can get all of it out and put it back. That means every key, not the three
 * that happened to be wired up: the theme and the reader's preferences live
 * under their own keys and were previously lost by a "full" export.
 *
 * Restore is deliberately blunt: it replaces, it does not merge. Merging two
 * sets of highlights without a shared clock invents an order that never
 * existed. The UI states this before doing anything.
 */
const BACKUP_FORMAT = 'offline-notes-backup';
const BACKUP_VERSION = 2;

// Every key the extension owns. A backup missing one is not a backup.
const BACKUP_KEYS = [
  'offline_notes',
  'offline_page_notes',
  'offline_notes_settings',
  'offline_notes_theme',
  'offline_notes_reader_prefs',
];

class BackupManager {
  async export() {
    const data = await chrome.storage.local.get(BACKUP_KEYS);
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  /**
   * Validate a parsed backup and describe what restoring it would do, so the
   * user is never asked to approve an opaque file.
   * Accepts the pre-v2 shape ({notes, pageNotes, settings}) as well.
   */
  inspect(parsed) {
    const errors = [];
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, errors: ['That file is not a backup.'], summary: null };
    }

    let data;
    if (parsed.format === BACKUP_FORMAT && parsed.data) {
      data = parsed.data;
    } else if (Array.isArray(parsed.notes) || parsed.pageNotes) {
      // Older export shape, before backups carried every key.
      data = {
        offline_notes: parsed.notes || [],
        offline_page_notes: parsed.pageNotes || {},
        offline_notes_settings: parsed.settings || undefined,
      };
    } else {
      return { valid: false, errors: ['That file is not an Offline Notes backup.'], summary: null };
    }

    const notes = data.offline_notes;
    const pages = data.offline_page_notes;
    if (notes !== undefined && !Array.isArray(notes)) errors.push('Notes are malformed.');
    if (pages !== undefined && (typeof pages !== 'object' || Array.isArray(pages))) {
      errors.push('Page notes are malformed.');
    }
    if (errors.length) return { valid: false, errors, summary: null };

    const pageList = Object.values(pages || {});
    const summary = {
      notes: (notes || []).length,
      pageNotes: pageList.length,
      highlights: pageList.reduce((n, p) => n + ((p.highlights || []).length), 0),
      articles: pageList.filter((p) => p.savedContent).length,
      exportedAt: parsed.exportedAt || null,
      includesPreferences: !!(data.offline_notes_theme || data.offline_notes_reader_prefs),
    };
    return { valid: true, errors: [], summary, data };
  }

  /**
   * Replace stored data with a backup's contents.
   * Keys absent from the backup are left alone rather than cleared, so an
   * older file cannot silently wipe something it never knew about.
   */
  async restore(data) {
    const payload = {};
    for (const key of BACKUP_KEYS) {
      if (data[key] !== undefined) payload[key] = data[key];
    }
    if (!Object.keys(payload).length) throw new Error('Nothing in that backup to restore');
    await chrome.storage.local.set(payload);
    return Object.keys(payload);
  }

  filename() {
    const d = new Date();
    const stamp = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return `offline-notes-backup-${stamp}.json`;
  }

  download(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackupManager, BACKUP_KEYS, BACKUP_FORMAT, BACKUP_VERSION };
}
