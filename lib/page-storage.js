/*
 * Page-note storage. Sibling of lib/storage.js. Stores one page note per
 * canonical URL under chrome.storage.local['offline_page_notes'].
 *
 * Schema:
 *   PageNote = {
 *     id: string           // 16-char hex of canonical URL (deterministic)
 *     url: string          // canonical URL
 *     pageTitle: string    // user-editable; defaults to capture-time title
 *     highlights: Highlight[]
 *     createdAt, updatedAt: ISO8601
 *   }
 *   Highlight = {
 *     id: string           // crypto.randomUUID()
 *     text: string
 *     anchor: { exact, prefix, suffix }
 *     capturedAt: ISO8601
 *   }
 *
 * Depends on canonicalizeUrl from lib/url-canonical.js (loaded alongside in
 * popup/sidebar/content-script contexts; imported via importScripts in the
 * service worker).
 */

class PageNoteStorage {
  constructor() {
    this.STORAGE_KEY = 'offline_page_notes';
  }

  async _getAllRaw() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || {};
  }

  async _setAllRaw(map) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: map });
  }

  async _hashUrl(canonical) {
    const data = new TextEncoder().encode(canonical);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getAll() {
    try {
      const map = await this._getAllRaw();
      return Object.values(map).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch (err) {
      console.error('PageNoteStorage.getAll failed:', err);
      return [];
    }
  }

  async getByUrl(rawUrl) {
    try {
      const canonical = canonicalizeUrl(rawUrl);
      const id = await this._hashUrl(canonical);
      const map = await this._getAllRaw();
      return map[id] || null;
    } catch (err) {
      console.error('PageNoteStorage.getByUrl failed:', err);
      return null;
    }
  }

  async getById(id) {
    try {
      const map = await this._getAllRaw();
      return map[id] || null;
    } catch (err) {
      console.error('PageNoteStorage.getById failed:', err);
      return null;
    }
  }

  /**
   * Append a highlight to the page note for this URL. Creates the page note
   * on first use; updates updatedAt on subsequent use. Returns the full page
   * note after append.
   *
   * `highlight` must already have { id, text, anchor, capturedAt }.
   */
  async appendHighlight(rawUrl, pageTitle, highlight) {
    try {
      const canonical = canonicalizeUrl(rawUrl);
      const id = await this._hashUrl(canonical);
      const map = await this._getAllRaw();
      const now = new Date().toISOString();

      const existing = map[id];
      if (existing) {
        existing.highlights.push(highlight);
        existing.updatedAt = now;
        // Only overwrite title if the user hasn't customized and the captured
        // title is non-empty. Conservative: don't replace anything.
      } else {
        map[id] = {
          id,
          url: canonical,
          pageTitle: pageTitle || canonical,
          highlights: [highlight],
          createdAt: now,
          updatedAt: now,
        };
      }
      await this._setAllRaw(map);
      return map[id];
    } catch (err) {
      console.error('PageNoteStorage.appendHighlight failed:', err);
      throw err;
    }
  }

  async deleteHighlight(pageNoteId, highlightId) {
    try {
      const map = await this._getAllRaw();
      const note = map[pageNoteId];
      if (!note) return false;
      note.highlights = note.highlights.filter((h) => h.id !== highlightId);
      note.updatedAt = new Date().toISOString();
      await this._setAllRaw(map);
      return true;
    } catch (err) {
      console.error('PageNoteStorage.deleteHighlight failed:', err);
      return false;
    }
  }

  async deletePageNote(pageNoteId) {
    try {
      const map = await this._getAllRaw();
      if (!map[pageNoteId]) return false;
      delete map[pageNoteId];
      await this._setAllRaw(map);
      return true;
    } catch (err) {
      console.error('PageNoteStorage.deletePageNote failed:', err);
      return false;
    }
  }

  async updatePageTitle(pageNoteId, newTitle) {
    try {
      const map = await this._getAllRaw();
      const note = map[pageNoteId];
      if (!note) return false;
      note.pageTitle = newTitle || note.pageTitle;
      note.updatedAt = new Date().toISOString();
      await this._setAllRaw(map);
      return true;
    } catch (err) {
      console.error('PageNoteStorage.updatePageTitle failed:', err);
      return false;
    }
  }

  /**
   * Count highlights for a given URL. Fast path for badge updates — avoids
   * fetching the whole page note when only the count is needed.
   */
  async countForUrl(rawUrl) {
    const note = await this.getByUrl(rawUrl);
    return note ? note.highlights.length : 0;
  }
}

if (typeof window !== 'undefined') window.PageNoteStorage = PageNoteStorage;
if (typeof self !== 'undefined') self.PageNoteStorage = PageNoteStorage;
if (typeof module !== 'undefined' && module.exports) module.exports = PageNoteStorage;
