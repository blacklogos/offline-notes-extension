/*
 * Reader — turning saved article text plus stored highlights into rendered
 * paragraphs with marks.
 *
 * The saved article is plain text (see lib/page-content.js for why), so this
 * builds paragraph elements and text nodes itself. Nothing is ever assigned
 * through innerHTML: the text came from someone else's web page, and marks are
 * created as real elements instead.
 */
(() => {
  // Paragraph boundaries, with each paragraph's offset into the full text, so
  // a highlight located against the whole article can be placed precisely.
  function splitParagraphs(text) {
    const out = [];
    const re = /\n{2,}/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ start: last, text: text.slice(last, m.index) });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ start: last, text: text.slice(last) });
    return out;
  }

  /**
   * Work out where each highlight sits in the article.
   * Returns { located: [{highlight, start, end}], lost: [highlight] }.
   */
  function locateHighlights(text, highlights) {
    const located = [], lost = [];
    for (const h of highlights) {
      const quote = (h.anchor && h.anchor.exact) || h.text || '';
      const hit = window.TextLocate.locate(text, quote, h.anchor || {});
      if (hit) located.push({ highlight: h, start: hit.start, end: hit.end });
      else lost.push(h);
    }
    located.sort((a, b) => a.start - b.start);
    return { located, lost };
  }

  // Build one paragraph, splicing in any marks that fall inside it.
  function buildParagraph(para, ranges) {
    const el = document.createElement('p');
    const pStart = para.start, pEnd = para.start + para.text.length;
    const inside = ranges
      .filter(r => r.start < pEnd && r.end > pStart)
      .sort((a, b) => a.start - b.start);

    let cursor = pStart;
    for (const r of inside) {
      const s = Math.max(r.start, pStart);
      const e = Math.min(r.end, pEnd);
      if (s < cursor) continue; // overlapping highlight already covered
      if (s > cursor) el.appendChild(document.createTextNode(para.text.slice(cursor - pStart, s - pStart)));
      const mark = document.createElement('mark');
      mark.className = 'rd-mark';
      mark.dataset.hlId = r.highlight.id;
      if (r.highlight.comment) mark.classList.add('has-note');
      mark.textContent = para.text.slice(s - pStart, e - pStart);
      el.appendChild(mark);
      cursor = e;
    }
    if (cursor < pEnd) el.appendChild(document.createTextNode(para.text.slice(cursor - pStart)));
    return el;
  }

  function renderArticle(container, text, ranges) {
    const frag = document.createDocumentFragment();
    for (const para of splitParagraphs(text)) frag.appendChild(buildParagraph(para, ranges));
    container.appendChild(frag);
  }

  // Offset of a DOM position inside the article, so a selection made in the
  // reader can be stored with the same prefix/suffix shape as a live capture.
  function offsetOf(articleEl, node, offset) {
    const walker = document.createTreeWalker(articleEl, NodeFilter.SHOW_TEXT);
    let total = 0, prevParagraph = null;
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const para = n.parentElement.closest('p');
      // Paragraphs were joined by a blank line in the source text.
      if (prevParagraph && para !== prevParagraph) total += 2;
      prevParagraph = para;
      if (n === node) return total + offset;
      total += n.data.length;
    }
    return -1;
  }

  window.ReaderArticle = { splitParagraphs, locateHighlights, renderArticle, offsetOf };
})();
