/*
 * Offline Notes — highlight colours and emphasis.
 *
 * One definition shared by the live page, the reader and the sidebar, so a
 * highlight looks the same everywhere. The palette is deliberately small:
 * five colours people can tell apart at a glance and assign their own meaning
 * to. Naming them by hue rather than by purpose ("important", "todo") avoids
 * imposing a system on the user.
 *
 * Values are muted enough to read black text on paper and are paired with a
 * dark-mode variant, because a marker that glows is unusable at night.
 *
 * Emphasis is Forte's third layer: the part of a quote that matters most,
 * stored as offsets into the highlight's OWN text rather than the article, so
 * it travels with the quote and survives the page changing underneath.
 */
const HIGHLIGHT_COLORS = {
  yellow: { light: '#F4E4A1', dark: '#5A4A1F', label: 'Yellow' },
  green:  { light: '#C5DCC0', dark: '#2F4A2C', label: 'Green' },
  blue:   { light: '#BFD4E8', dark: '#26405C', label: 'Blue' },
  pink:   { light: '#EFC8CE', dark: '#5A2C36', label: 'Pink' },
  purple: { light: '#D6C9E6', dark: '#3E2F55', label: 'Purple' },
};

const DEFAULT_HIGHLIGHT_COLOR = 'yellow';

// Records saved before colours existed have none; they are yellow.
function colorOf(highlight) {
  const c = highlight && highlight.color;
  return Object.prototype.hasOwnProperty.call(HIGHLIGHT_COLORS, c) ? c : DEFAULT_HIGHLIGHT_COLOR;
}

/**
 * Split a highlight's text into runs, marking which are emphasised.
 * Returns [{text, strong}] covering the whole string in order, so a renderer
 * can build elements without doing offset arithmetic itself.
 */
function emphasisRuns(text, emphasis) {
  const src = text || '';
  const ranges = (emphasis || [])
    .filter((e) => e && Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start)
    .map((e) => ({ start: Math.max(0, e.start), end: Math.min(src.length, e.end) }))
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start);

  // Overlapping emphases would otherwise produce nested or duplicated runs.
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }

  const runs = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) runs.push({ text: src.slice(cursor, r.start), strong: false });
    runs.push({ text: src.slice(r.start, r.end), strong: true });
    cursor = r.end;
  }
  if (cursor < src.length) runs.push({ text: src.slice(cursor), strong: false });
  return runs.length ? runs : [{ text: src, strong: false }];
}

/** Markdown for a quote, with emphasis as bold. Used by every exporter. */
function quoteToMarkdown(highlight) {
  return emphasisRuns(highlight.text, highlight.emphasis)
    .map((run) => (run.strong && run.text.trim() ? `**${run.text}**` : run.text))
    .join('');
}

/** Add an emphasis range, merging it into any it touches. */
function addEmphasis(existing, start, end) {
  const next = (existing || []).concat([{ start, end }]);
  const runs = emphasisRuns('x'.repeat(Math.max(end, 1)), next);
  // Recompute merged ranges from the runs so storage never holds overlaps.
  const merged = [];
  let at = 0;
  for (const run of runs) {
    if (run.strong) merged.push({ start: at, end: at + run.text.length });
    at += run.text.length;
  }
  return merged;
}

if (typeof window !== 'undefined') {
  window.HighlightStyle = { HIGHLIGHT_COLORS, DEFAULT_HIGHLIGHT_COLOR, colorOf, emphasisRuns, quoteToMarkdown, addEmphasis };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HIGHLIGHT_COLORS, DEFAULT_HIGHLIGHT_COLOR, colorOf, emphasisRuns, quoteToMarkdown, addEmphasis };
}
