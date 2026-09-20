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
      if (hit) located.push({ highlight: h, start: hit.start, end: hit.end, emphasis: emphasisInArticle(h, text, hit) });
      else lost.push(h);
    }
    located.sort((a, b) => a.start - b.start);
    return { located, lost };
  }

  /**
   * Translate emphasis into article coordinates.
   *
   * Emphasis offsets index the highlight's OWN text, which is deliberate: it
   * survives the page changing. But the article slice the quote was located
   * in can differ from that text, because locating normalises whitespace and
   * punctuation. Slicing article text with highlight-text offsets therefore
   * drops or duplicates characters. Each emphasised piece is located inside
   * the span instead, so painting works in one coordinate system throughout.
   */
  function emphasisInArticle(highlight, articleText, hit) {
    const list = highlight.emphasis || [];
    if (!list.length) return [];
    const span = articleText.slice(hit.start, hit.end);
    const source = highlight.text || '';
    const out = [];
    for (const e of list) {
      const piece = source.slice(e.start, e.end);
      if (!piece.trim()) continue;
      const found = window.TextLocate.locate(span, piece, {});
      if (found) out.push({ start: hit.start + found.start, end: hit.start + found.end });
    }
    return out;
  }

  // Build one paragraph, splicing in any marks that fall inside it.
  function buildParagraph(para, ranges, tag) {
    const el = document.createElement(tag || 'p');
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
      mark.dataset.color = window.HighlightStyle.colorOf(r.highlight);
      if (r.highlight.comment) mark.classList.add('has-note');
      // Everything here is in article coordinates: the mark's own text, and
      // the emphasis ranges translated by emphasisInArticle.
      const markText = para.text.slice(s - pStart, e - pStart);
      const relative = (r.emphasis || [])
        .map((x) => ({ start: x.start - s, end: x.end - s }))
        .filter((x) => x.end > 0 && x.start < (e - s));
      window.HighlightStyle.paintRuns(mark, window.HighlightStyle.emphasisRuns(markText, relative));
      el.appendChild(mark);
      cursor = e;
    }
    if (cursor < pEnd) el.appendChild(document.createTextNode(para.text.slice(cursor - pStart)));
    return el;
  }

  const TAG_BY_KIND = { h2: 'h2', h3: 'h3', h4: 'h4', li: 'li', quote: 'blockquote', pre: 'pre', caption: 'figcaption', p: 'p' };

  // Blocks describe how to present the flat text; when a capture predates them
  // we fall back to paragraph splitting, so old page notes still read fine.
  function segmentsFor(text, blocks) {
    const flat = () => splitParagraphs(text).map(p => ({ kind: 'p', start: p.start, text: p.text }));
    if (!blocks || !blocks.length) return flat();
    const usable = blocks
      .filter(b => b.end > b.start && b.start >= 0 && b.end <= text.length)
      .sort((a, b) => a.start - b.start);
    // Structure is a presentation nicety; losing the article is not. If the
    // blocks do not account for nearly all of the text, ignore them.
    const covered = usable.reduce((n, b) => n + (b.end - b.start), 0);
    if (!usable.length || covered < text.length * 0.9) return flat();
    return usable
      .map(b => ({ kind: b.kind || 'p', start: b.start, text: text.slice(b.start, b.end) }))
      // Captures made before [edit] links were filtered still carry them.
      .filter(seg => !/^\[\s*edit\s*\]$/i.test(seg.text.trim()));
  }

  function renderArticle(container, text, ranges, blocks) {
    const frag = document.createDocumentFragment();
    let list = null;
    for (const seg of segmentsFor(text, blocks)) {
      const tag = TAG_BY_KIND[seg.kind] || 'p';
      const el = buildParagraph(seg, ranges, tag);
      // Consecutive list items belong inside one list.
      if (tag === 'li') {
        if (!list) { list = document.createElement('ul'); frag.appendChild(list); }
        list.appendChild(el);
      } else {
        list = null;
        frag.appendChild(el);
      }
    }
    container.appendChild(frag);
  }

  // Offset of a DOM position inside the article, so a selection made in the
  // reader can be stored with the same prefix/suffix shape as a live capture.
  const BLOCK_SEL = 'p, h2, h3, h4, li, blockquote, pre, figcaption';

  function offsetOf(bodyEl, node, offset) {
    const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT);
    let total = 0, prevBlock = null;
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const block = n.parentElement && n.parentElement.closest(BLOCK_SEL);
      // Blocks were separated by a blank line in the stored text.
      if (prevBlock && block !== prevBlock) total += 2;
      prevBlock = block;
      if (n === node) return total + offset;
      total += n.data.length;
    }
    return -1;
  }

  window.ReaderArticle = { splitParagraphs, segmentsFor, locateHighlights, renderArticle, offsetOf };
})();
