/*
 * Offline Notes — readable article extraction.
 *
 * Runs on demand only. This file and lib/readability.js are injected by the
 * service worker when the user explicitly saves a page, never declared as
 * content scripts, so no page pays the parse cost for a feature it never uses.
 *
 * The result is stored as PLAIN TEXT, not HTML, on purpose. Rendering saved
 * article HTML later would pull remote images, favicons and embeds, so merely
 * opening a saved page would make network requests the user never asked for.
 * Text keeps the promise that nothing leaves the machine.
 */
(() => {
  // Block-level tags become their own paragraph in the extracted text.
  const BLOCKS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'BLOCKQUOTE', 'PRE', 'FIGCAPTION', 'TD', 'TH', 'DT', 'DD']);

  // Readability returns HTML. Walk it and emit readable text with paragraph
  // breaks, rather than textContent, which runs every block together.
  function htmlToText(html) {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    const parts = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.textContent.replace(/\s+/g, ' ').trim();
          if (t) parts.push({ text: t, block: false });
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
        const isBlock = BLOCKS.has(tag);
        if (isBlock) parts.push({ break: true });
        if (tag === 'BR') parts.push({ break: true });
        walk(child);
        if (isBlock) parts.push({ break: true });
      }
    };
    walk(doc.body);

    let out = '';
    let pendingBreak = false;
    for (const p of parts) {
      if (p.break) { pendingBreak = true; continue; }
      if (out) {
        if (pendingBreak) out += '\n\n';
        // Joining inline elements with a blind space produced "book pages ."
        // and " [ 1 ] ". Don't space before closing punctuation or a bracket.
        else if (!/^[.,;:!?)\]]/.test(p.text) && !/[([]$/.test(out)) out += ' ';
      }
      out += p.text;
      pendingBreak = false;
    }
    return out
      .replace(/\[\s+/g, '[')
      .replace(/\s+\]/g, ']')
      // Section "[edit]" affordances are page furniture, not article text.
      .replace(/^\s*\[edit\]\s*$/gim, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract the readable article from the current page.
   * Returns null when the page has no article-shaped content, which is the
   * honest answer for a dashboard, a search results page or an app shell.
   */
  window.__offlineNotesExtractArticle = function extractArticle() {
    try {
      // Readability mutates the document it is given, so hand it a clone.
      const clone = document.cloneNode(true);
      const article = new Readability(clone, { keepClasses: false }).parse();
      if (!article || !article.content) return null;
      const text = htmlToText(article.content);
      if (!text || text.length < 200) return null; // too thin to be worth storing
      return {
        text,
        title: article.title || document.title || '',
        byline: article.byline || '',
        siteName: article.siteName || location.hostname,
        excerpt: article.excerpt || '',
        chars: text.length,
        savedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Offline Notes: article extraction failed', err);
      return null;
    }
  };
})();
