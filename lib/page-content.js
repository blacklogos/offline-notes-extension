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
      const { text, blocks } = window.TextBlocks.htmlToBlocks(article.content);
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
