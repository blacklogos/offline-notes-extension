/*
 * Locating a stored quote inside the rebuilt article text.
 *
 * Highlights are anchored against the live DOM; the snapshot is rebuilt with
 * collapsed whitespace and tightened punctuation. These two strings are never
 * byte-identical, which is why a plain indexOf loses real highlights.
 */
module.exports = ({ test, eq, ok, root }) => {
  const { locate, normalize } = require(root + '/lib/text-locate.js');

  test('normalize collapses whitespace', () => {
    eq(normalize('a   b\n\nc'), 'a b c');
  });

  test('normalize tightens punctuation the extractor moved', () => {
    eq(normalize('book pages . see [ 1 ] here'), 'book pages. see [1] here');
  });

  test('locates a quote whose spacing differs from the snapshot', () => {
    const hay = 'An annotation is  extra   information about a\nresource.';
    const hit = locate(hay, 'extra information about a resource.', {});
    ok(hit, 'should find the quote');
    eq(hay.slice(hit.start, hit.end), 'extra   information about a\nresource.');
  });

  test('maps offsets back to the original string, not the normalized one', () => {
    const hay = 'x   y zebra';
    const hit = locate(hay, 'zebra', {});
    eq(hay.slice(hit.start, hit.end), 'zebra');
    eq(hit.start, 6);
  });

  test('returns null for a quote that is not present', () => {
    eq(locate('nothing matching here', 'absent quote', {}), null);
  });

  test('refuses to guess when a repeated quote has no context', () => {
    eq(locate('the cat sat. the cat sat.', 'the cat sat', { prefix: '', suffix: '' }), null);
  });

  test('uses stored prefix to disambiguate a repeated quote', () => {
    const hay = 'alpha the cat sat. omega the cat sat.';
    const hit = locate(hay, 'the cat sat', { prefix: 'omega', suffix: '' });
    ok(hit, 'should resolve via prefix');
    ok(hit.start > 18, 'should pick the second occurrence');
  });

  test('uses stored suffix to disambiguate a repeated quote', () => {
    const hay = 'the cat sat here. the cat sat there.';
    const hit = locate(hay, 'the cat sat', { prefix: '', suffix: 'there' });
    ok(hit && hit.start > 16, 'should pick the occurrence followed by "there"');
  });

  test('handles an empty or missing quote without throwing', () => {
    eq(locate('some text', '', {}), null);
    eq(locate('', 'quote', {}), null);
  });

  test('locates Vietnamese text with diacritics', () => {
    const hay = 'Quý 4 không chỉ là quý chạy số để hoàn thành mục tiêu, mà còn là lúc lập kế hoạch.';
    const hit = locate(hay, 'lập kế hoạch', {});
    ok(hit, 'should find the Vietnamese quote');
    eq(hay.slice(hit.start, hit.end), 'lập kế hoạch');
  });

  test('locates a quote selected across block boundaries', () => {
    // range.toString() concatenates across block elements with no separator,
    // so a multi-paragraph selection arrives as "...reads fromMore of You..."
    // while the saved article has a blank line between those paragraphs.
    const article = [
      'Intelligence: the context everything else reads from',
      'More of You: skills that scale how you work',
      'Better Thinking: skills that challenge your judgement',
    ].join('\n\n');
    const quote = 'the context everything else reads fromMore of You: skills that scale how you workBetter Thinking';
    const hit = locate(article, quote, {});
    ok(hit, 'a multi-block selection must still be locatable');
    const got = article.slice(hit.start, hit.end).replace(/\s+/g, ' ');
    ok(got.startsWith('the context everything else reads from'), `got: ${got}`);
    ok(got.endsWith('Better Thinking'), `got: ${got}`);
  });

  test('block-joined quote still respects word boundaries', () => {
    // "fromMore" must not match text that genuinely reads "fromMORE" elsewhere
    // in a way that skips content: the span located must cover the same words.
    const article = 'alpha beta\n\ngamma delta';
    const hit = locate(article, 'betagamma', {});
    ok(hit, 'should join across the blank line');
    eq(article.slice(hit.start, hit.end), 'beta\n\ngamma');
  });

  test('a quote taken by offset round-trips exactly', () => {
    // What the reader now stores: the article slice, not the selection string.
    const article = 'Para one ends here.\n\nPara two starts there.';
    const start = article.indexOf('ends here');
    const end = article.indexOf('starts there') + 'starts there'.length;
    const quote = article.slice(start, end);
    const hit = locate(article, quote, {});
    ok(hit, 'offset-derived quote must locate');
    eq([hit.start, hit.end], [start, end], 'and land on the same span');
  });
};
