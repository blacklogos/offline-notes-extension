/*
 * Listing order. Before this, the reader, the sidebar and markdown export each
 * used a different one for the same page note.
 */
module.exports = ({ test, eq, ok, root }) => {
  const { sortHighlights, normalizeOrder, DEFAULT_HIGHLIGHT_ORDER, HIGHLIGHT_ORDERS } =
    require(root + '/lib/highlight-order.js');

  const at = (iso, id) => ({ id, capturedAt: iso });
  const sample = [
    at('2026-01-01T10:00:00Z', 'a'),
    at('2026-03-01T10:00:00Z', 'c'),
    at('2026-02-01T10:00:00Z', 'b'),
  ];

  test('oldest first is chronological', () => {
    eq(sortHighlights(sample, 'oldest').map(h => h.id), ['a', 'b', 'c']);
  });

  test('newest first is the reverse', () => {
    eq(sortHighlights(sample, 'newest').map(h => h.id), ['c', 'b', 'a']);
  });

  test('newest first is the default', () => {
    eq(normalizeOrder(undefined), DEFAULT_HIGHLIGHT_ORDER);
    eq(sortHighlights(sample, 'nonsense').map(h => h.id), sortHighlights(sample, 'newest').map(h => h.id));
  });

  test('records without a timestamp keep their stored position', () => {
    const mixed = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    eq(sortHighlights(mixed, 'oldest').map(h => h.id), ['x', 'y', 'z']);
    eq(sortHighlights(mixed, 'newest').map(h => h.id), ['z', 'y', 'x']);
  });

  test('identical timestamps stay stable rather than shuffling', () => {
    const same = [at('2026-01-01T10:00:00Z', 'a'), at('2026-01-01T10:00:00Z', 'b')];
    eq(sortHighlights(same, 'oldest').map(h => h.id), ['a', 'b']);
  });

  test('sorting never mutates the caller list', () => {
    const original = sample.slice();
    sortHighlights(sample, 'oldest');
    eq(sample.map(h => h.id), original.map(h => h.id));
  });

  test('empty input is handled', () => {
    eq(sortHighlights([], 'newest'), []);
    eq(sortHighlights(undefined, 'newest'), []);
  });

  test('every order has a label for the UI', () => {
    for (const [k, v] of Object.entries(HIGHLIGHT_ORDERS)) ok(v.label, `${k} label`);
  });
};
