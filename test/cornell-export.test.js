/*
 * Cornell layout. It adds no fields: the cue column is the comment already on
 * a highlight, the notes column is the quote, the summary is the page summary.
 */
module.exports = ({ test, eq, ok, root }) => {
  const { CornellExporter } = require(root + '/lib/cornell-export.js');
  const ex = new CornellExporter();

  const note = {
    pageTitle: 'A Page',
    url: 'https://example.com/a',
    updatedAt: '2026-09-20T10:00:00Z',
    summary: 'The page argues one thing.',
    highlights: [
      { id: 'h1', text: 'first quote', comment: 'why it matters' },
      { id: 'h2', text: 'second quote', comment: '' },
    ],
  };

  test('emits a cue and notes table', () => {
    const md = ex.export(note, null);
    ok(md.includes('| Cue | Notes |'), 'table header');
    ok(md.includes('| why it matters | first quote |'), 'comment becomes the cue');
  });

  test('a highlight without a comment keeps its row', () => {
    const md = ex.export(note, null);
    ok(/\|\s*\| second quote \|/.test(md), 'blank cue, quote still present');
  });

  test('the summary goes underneath, as Cornell expects', () => {
    const md = ex.export(note, null);
    const table = md.indexOf('| Cue | Notes |');
    const summary = md.indexOf('## Summary');
    ok(table < summary, 'summary follows the table');
    ok(md.includes('The page argues one thing.'), 'summary text present');
  });

  test('a missing summary is named rather than silently empty', () => {
    const md = ex.export({ ...note, summary: '' }, null);
    ok(md.includes('_Not written yet._'), 'says the summary is missing');
  });

  test('pipes and newlines cannot break the table', () => {
    const md = ex.export({ ...note, highlights: [
      { id: 'x', text: 'a | b\nsecond line', comment: 'pipe | here' },
    ] }, null);
    const row = md.split('\n').find(l => l.includes('second line'));
    ok(row, 'row present');
    // Exactly three unescaped pipes: the two edges and the column separator.
    eq((row.match(/(^|[^\\])\|/g) || []).length, 3, 'only the cell separators are unescaped');
    ok(row.includes('\\|'), 'pipes inside the content are escaped');
    ok(row.includes('a \\| b second line'), 'newline folded into the cell');
  });

  test('emphasis survives as bold in the notes column', () => {
    const md = ex.export({ ...note, highlights: [
      { id: 'e', text: 'the quick brown fox', emphasis: [{ start: 4, end: 9 }], comment: 'cue' },
    ] }, null);
    ok(md.includes('the **quick** brown fox'), 'bold preserved');
  });

  test('a selection exports only those rows', () => {
    const md = ex.export(note, ['h2']);
    ok(md.includes('second quote'), 'selected row present');
    ok(!md.includes('first quote'), 'unselected row absent');
  });

  test('filename is derived from the title', () => {
    eq(ex.filename({ pageTitle: 'A Page!' }), 'a-page-cornell.md');
    eq(ex.filename({}), 'page-cornell.md');
  });
};
