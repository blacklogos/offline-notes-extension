/*
 * Offline Notes — import a local Markdown or HTML file.
 *
 * Reading a file into the extension rather than highlighting it at a file://
 * URL, for two reasons. Content scripts do not run on file:// unless the user
 * manually ticks "Allow access to file URLs", which cannot be prompted for.
 * And a .md file opened in Chrome is one undifferentiated <pre>, so there is
 * no structure to work with. Imported, it becomes an ordinary page note: the
 * reader renders it, highlights anchor in it, export and the vault carry it.
 *
 * Markdown is reduced to readable text plus block kinds, the same shape the
 * web extractor produces, so nothing downstream needs to know where a page
 * note came from. Inline syntax is stripped rather than rendered: the reader
 * shows prose, and a quote you highlight should read like the sentence you
 * saw, not like source.
 */
(() => {
  const IMPORT_SCHEME = 'offline-notes:';

  // Deterministic per file name, so re-importing the same file updates its page
  // note instead of creating a second one.
  function importUrlFor(filename) {
    const name = String(filename || 'untitled');
    const slug = name
      .replace(/\.[^.]+$/, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'untitled';
    // The slug alone collides: "A B.md" and "A-B.md" both reduce to "a-b",
    // and the second import would replace the first document while keeping
    // its highlights, attaching them to text they never came from. A short
    // digest of the full name keeps distinct files distinct while staying
    // stable, so re-importing the same file still updates the same note.
    return `${IMPORT_SCHEME}//import/${slug}-${shortDigest(name)}`;
  }

  // Small, stable, non-cryptographic: this only has to separate names.
  function shortDigest(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).slice(0, 6);
  }

  function isImportedUrl(url) {
    return typeof url === 'string' && url.startsWith(IMPORT_SCHEME);
  }

  // Inline markdown, reduced to the words. Links keep their label, not the URL.
  function stripInline(text) {
    // Code spans are literal: their contents must survive untouched, or
    // `__init__` becomes `init`. They are lifted out, the rest is reduced,
    // then they are put back.
    const spans = [];
    let working = String(text).replace(/`([^`]*)`/g, (_, code) => {
      spans.push(code);
      return `\u0000${spans.length - 1}\u0000`;
    });

    working = working
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
      .replace(/\*(\S(?:.*?\S)?)\*/g, '$1')
      // Underscores only delimit emphasis at word boundaries, so intraword
      // underscores in foo_bar_baz are literal and must be left alone.
      .replace(/(^|[^\w])__(\S(?:.*?\S)?)__(?![\w])/g, '$1$2')
      .replace(/(^|[^\w])_(\S(?:.*?\S)?)_(?![\w])/g, '$1$2')
      .replace(/~~(.*?)~~/g, '$1');

    return working.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)]).trim();
  }

  const MD_HEADING = /^(#{1,6})\s+(.*)$/;
  const MD_LIST = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*)$/;
  const MD_QUOTE = /^\s{0,3}>\s?(.*)$/;
  const MD_FENCE = /^\s{0,3}(```|~~~)/;
  const MD_RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

  /**
   * Markdown to { text, blocks, title }.
   * Offsets are recorded while the text is assembled, so they cannot drift.
   */
  function markdownToBlocks(source) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let text = '';
    let title = '';
    let paragraph = [];
    let inFence = false;
    let fence = [];

    const push = (kind, content) => {
      const clean = kind === 'pre' ? content : stripInline(content);
      if (!clean) return;
      const start = text ? text.length + 2 : 0;
      text += (text ? '\n\n' : '') + clean;
      blocks.push({ kind, start, end: text.length });
    };

    const flushParagraph = () => {
      if (!paragraph.length) return;
      push('p', paragraph.join(' ').replace(/\s+/g, ' ').trim());
      paragraph = [];
    };

    for (const raw of lines) {
      if (MD_FENCE.test(raw)) {
        if (inFence) { push('pre', fence.join('\n')); fence = []; inFence = false; }
        else { flushParagraph(); inFence = true; }
        continue;
      }
      if (inFence) { fence.push(raw); continue; }

      const line = raw.trimEnd();
      if (!line.trim() || MD_RULE.test(line)) { flushParagraph(); continue; }

      const heading = line.match(MD_HEADING);
      if (heading) {
        flushParagraph();
        const level = heading[1].length;
        const content = heading[2];
        if (!title && level === 1) title = stripInline(content);
        push(level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4', content);
        continue;
      }

      const quote = line.match(MD_QUOTE);
      if (quote) { flushParagraph(); push('quote', quote[1]); continue; }

      const item = line.match(MD_LIST);
      if (item) { flushParagraph(); push('li', item[1]); continue; }

      paragraph.push(line.trim());
    }
    if (inFence && fence.length) push('pre', fence.join('\n'));
    flushParagraph();

    return { text, blocks, title };
  }

  /** HTML file to the same shape, reusing the shared DOM walker. */
  function htmlFileToBlocks(source) {
    const doc = new DOMParser().parseFromString(String(source || ''), 'text/html');
    const title = (doc.querySelector('title') || {}).textContent || '';
    const body = doc.body ? doc.body.innerHTML : '';
    const { text, blocks } = window.TextBlocks.htmlToBlocks(body);
    return { text, blocks, title: (title || '').trim() };
  }

  function kindOf(filename) {
    const name = String(filename || '').toLowerCase();
    if (/\.(md|markdown|mdown|txt)$/.test(name)) return 'markdown';
    if (/\.(html?|xhtml)$/.test(name)) return 'html';
    return null;
  }

  /**
   * Build the savedContent record for a file.
   * Returns null when the file has no readable text, so an empty import is
   * refused rather than stored as a blank page note.
   */
  function buildSavedContent(filename, source) {
    const kind = kindOf(filename);
    if (!kind) return null;
    const parsed = kind === 'markdown' ? markdownToBlocks(source) : htmlFileToBlocks(source);
    if (!parsed.text || parsed.text.length < 20) return null;
    return {
      text: parsed.text,
      blocks: parsed.blocks,
      title: parsed.title || String(filename).replace(/\.[^.]+$/, ''),
      byline: '',
      siteName: 'Imported file',
      excerpt: parsed.text.slice(0, 200),
      chars: parsed.text.length,
      savedAt: new Date().toISOString(),
      sourceFile: String(filename),
    };
  }

  const api = { IMPORT_SCHEME, importUrlFor, isImportedUrl, kindOf, stripInline, markdownToBlocks, buildSavedContent };
  if (typeof window !== 'undefined') window.FileImport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})();
