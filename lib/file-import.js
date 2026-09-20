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
    const slug = String(filename || 'untitled')
      .replace(/\.[^.]+$/, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'untitled';
    return `${IMPORT_SCHEME}//import/${slug}`;
  }

  function isImportedUrl(url) {
    return typeof url === 'string' && url.startsWith(IMPORT_SCHEME);
  }

  // Inline markdown, reduced to the words. Links keep their label, not the URL.
  function stripInline(text) {
    return text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .trim();
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
