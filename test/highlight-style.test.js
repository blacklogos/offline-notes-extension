/*
 * Colours and emphasis: the shared definition used by the live page, the
 * reader and every exporter.
 */
module.exports = ({ test, eq, ok, root }) => {
  const { colorOf, emphasisRuns, quoteToMarkdown, addEmphasis, HIGHLIGHT_COLORS,
          DEFAULT_HIGHLIGHT_COLOR } = require(root + '/lib/highlight-style.js');

  test('records saved before colours existed read as the default', () => {
    eq(colorOf({}), DEFAULT_HIGHLIGHT_COLOR);
    eq(colorOf({ color: undefined }), DEFAULT_HIGHLIGHT_COLOR);
  });

  test('an unknown colour falls back rather than rendering nothing', () => {
    eq(colorOf({ color: 'chartreuse' }), DEFAULT_HIGHLIGHT_COLOR);
  });

  test('every colour has a light and a dark value', () => {
    for (const [name, v] of Object.entries(HIGHLIGHT_COLORS)) {
      ok(/^#[0-9A-F]{6}$/i.test(v.light), `${name} light`);
      ok(/^#[0-9A-F]{6}$/i.test(v.dark), `${name} dark`);
      ok(v.label, `${name} label`);
    }
  });

  test('a quote with no emphasis is one plain run', () => {
    eq(emphasisRuns('hello there', []), [{ text: 'hello there', strong: false }]);
    eq(emphasisRuns('hello there', undefined), [{ text: 'hello there', strong: false }]);
  });

  test('emphasis splits a quote into ordered runs covering all of it', () => {
    const runs = emphasisRuns('the quick brown fox', [{ start: 4, end: 9 }]);
    eq(runs.map(r => r.text).join(''), 'the quick brown fox', 'runs must cover the text');
    eq(runs.map(r => r.strong), [false, true, false]);
  });

  test('overlapping emphasis merges instead of nesting', () => {
    const runs = emphasisRuns('abcdefghij', [{ start: 0, end: 5 }, { start: 3, end: 8 }]);
    eq(runs.filter(r => r.strong).length, 1, 'one merged run');
    eq(runs.find(r => r.strong).text, 'abcdefgh');
  });

  test('out of range emphasis is clamped, not crashed on', () => {
    const runs = emphasisRuns('short', [{ start: -5, end: 99 }]);
    eq(runs.map(r => r.text).join(''), 'short');
    eq(runs.length, 1);
    ok(runs[0].strong, 'clamped to the whole string');
  });

  test('malformed emphasis is ignored', () => {
    eq(emphasisRuns('abc', [{ start: 2, end: 1 }, null, { start: 'x', end: 3 }]),
       [{ text: 'abc', strong: false }]);
  });

  test('markdown renders emphasis as bold', () => {
    eq(quoteToMarkdown({ text: 'the quick brown fox', emphasis: [{ start: 4, end: 9 }] }),
       'the **quick** brown fox');
  });

  test('markdown of an unemphasised quote is unchanged', () => {
    eq(quoteToMarkdown({ text: 'plain quote', emphasis: [] }), 'plain quote');
  });

  test('whitespace-only emphasis does not produce empty bold markers', () => {
    eq(quoteToMarkdown({ text: 'a   b', emphasis: [{ start: 1, end: 4 }] }), 'a   b');
  });

  test('adding emphasis merges touching ranges', () => {
    eq(addEmphasis([{ start: 0, end: 5 }], 3, 9), [{ start: 0, end: 9 }]);
    eq(addEmphasis([], 2, 4), [{ start: 2, end: 4 }]);
  });

  test('markdown escapes nothing inside an emphasised run', () => {
    // Emphasis wraps the run verbatim; the quote is user content, not source.
    eq(quoteToMarkdown({ text: 'a *b* c', emphasis: [{ start: 2, end: 5 }] }), 'a ***b*** c');
  });
};
