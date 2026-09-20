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

  // Block kinds worth keeping so the reader can set a heading as a heading and
  // a list item as a list item, instead of a wall of identical paragraphs.
  const KIND_BY_TAG = {
    H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h4', H6: 'h4',
    LI: 'li', BLOCKQUOTE: 'quote', PRE: 'pre', FIGCAPTION: 'caption',
  };

  // Readability returns HTML. Walk it once, emitting readable text with
  // paragraph breaks AND recording where each block landed in that output.
  // Offsets are captured as the text is built, never searched for afterwards:
  // searching drifts as soon as the same words appear twice.
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

  const EDIT_AFFORDANCE = /^\[\s*edit\s*\]$/i;

  function isEditAffordance(element) {
    const t = (element.textContent || '').replace(/\s+/g, ' ').trim();
    return EDIT_AFFORDANCE.test(t);
  }

  function htmlToBlocks(html) {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;

    let out = '';
    let pendingBreak = false;
    const blocks = [];

    const append = (raw) => {
      const t = raw.replace(/\s+/g, ' ')
        .replace(/\[\s+/g, '[')
        .replace(/\s+\]/g, ']')
        .trim();
      if (!t || t === '[edit]') return; // section affordance, not article text
      if (out) {
        if (pendingBreak) out += '\n\n';
        // Joining inline elements with a blind space produced "book pages ."
        // and " [ 1 ] ". Don't space before closing punctuation or a bracket.
        else if (!/^[.,;:!?)\]]/.test(t) && !/[([]$/.test(out)) out += ' ';
      }
      out += t;
      pendingBreak = false;
    };

    const walkInline = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) { append(child.textContent); continue; }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName;
        if (SKIP_TAGS.has(tag)) continue;
        if (tag === 'BR') { pendingBreak = true; continue; }
        if (isEditAffordance(child)) continue; // section [edit] link, not prose
        if (BLOCKS.has(tag)) { emitBlock(child); continue; }
        walkInline(child);
      }
    };

    const emitBlock = (element) => {
      // A wrapper whose children are themselves blocks contributes nothing of
      // its own; descend so each real block is recorded separately.
      const childBlocks = [...element.children].filter((c) => BLOCKS.has(c.tagName));
      const ownText = [...element.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
      if (childBlocks.length && !ownText) {
        for (const c of element.children) {
          if (BLOCKS.has(c.tagName)) emitBlock(c);
          else walkInline(c);
        }
        return;
      }
      pendingBreak = true;
      const startAt = out.length ? out.length + 2 : 0; // the break we just queued
      const before = blocks.length;
      walkInline(element);
      // If nested blocks recorded themselves, this element is a container.
      // Recording it too would overlap their ranges and the reader would
      // render the same words twice.
      if (out.length > startAt && blocks.length === before) {
        blocks.push({ kind: KIND_BY_TAG[element.tagName] || 'p', start: startAt, end: out.length });
      }
      pendingBreak = true;
    };

    for (const child of doc.body.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) { append(child.textContent); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      // walkInline only skips these among a node's CHILDREN, so a top-level
      // script or style would otherwise have its source appended as prose.
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (isEditAffordance(child)) continue;
      if (BLOCKS.has(child.tagName)) emitBlock(child);
      else walkInline(child);
    }

    // Nothing rewrites `out` after the fact, so the recorded offsets hold.
    // A leading trim would shift everything, so only the tail is trimmed.
    const text = out.replace(/\s+$/, '');
    return { text, blocks: blocks.filter((b) => b.end <= text.length) };
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
      const { text, blocks } = htmlToBlocks(article.content);
      if (!text || text.length < 200) return null; // too thin to be worth storing
      return {
        text,
        blocks,
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
