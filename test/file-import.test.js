/*
 * Importing local Markdown and HTML.
 *
 * The parser must produce exactly the shape the web extractor produces, so
 * nothing downstream needs to know where a page note came from: plain text
 * plus block offsets that slice back to the right words.
 */
module.exports = ({ test, eq, ok, root }) => {
  const fi = require(root + '/lib/file-import.js');

  test('recognises the formats it can read, and refuses others', () => {
    eq(fi.kindOf('notes.md'), 'markdown');
    eq(fi.kindOf('NOTES.MARKDOWN'), 'markdown');
    eq(fi.kindOf('page.html'), 'html');
    eq(fi.kindOf('scan.pdf'), null);
    eq(fi.kindOf('photo.png'), null);
  });

  test('the same file name always maps to the same page note', () => {
    eq(fi.importUrlFor('My Notes.md'), fi.importUrlFor('My Notes.md'));
    eq(fi.importUrlFor('My Notes.md'), 'offline-notes://import/my-notes');
    ok(fi.isImportedUrl(fi.importUrlFor('x.md')), 'recognised as imported');
    ok(!fi.isImportedUrl('https://example.com'), 'a web page is not');
  });

  test('inline markdown is reduced to the words', () => {
    eq(fi.stripInline('**bold** and _em_ and `code`'), 'bold and em and code');
    eq(fi.stripInline('a [link](http://example.com) here'), 'a link here');
    eq(fi.stripInline('![alt](img.png)'), 'alt');
    eq(fi.stripInline('~~struck~~'), 'struck');
  });

  test('headings become block kinds and the h1 becomes the title', () => {
    const r = fi.markdownToBlocks('# Doc\n\n## Two\n\n### Three\n\n#### Four\n');
    eq(r.title, 'Doc');
    eq(r.blocks.map(b => b.kind), ['h2', 'h2', 'h3', 'h4']);
  });

  test('block offsets slice back to the right text', () => {
    const r = fi.markdownToBlocks('# Title\n\nFirst para.\n\n- item one\n');
    for (const b of r.blocks) {
      ok(r.text.slice(b.start, b.end).length > 0, 'each block slices to something');
    }
    eq(r.text.slice(r.blocks[1].start, r.blocks[1].end), 'First para.');
    eq(r.text.slice(r.blocks[2].start, r.blocks[2].end), 'item one');
  });

  test('lists, quotes and code fences are distinguished', () => {
    const r = fi.markdownToBlocks('- a\n- b\n\n> quoted\n\n```\ncode();\n```\n');
    eq(r.blocks.map(b => b.kind), ['li', 'li', 'quote', 'pre']);
    eq(r.text.includes('code();'), true, 'fenced code kept verbatim');
  });

  test('wrapped lines join into one paragraph', () => {
    const r = fi.markdownToBlocks('one line\ncontinues here\n\nsecond para\n');
    eq(r.blocks.length, 2);
    eq(r.text.slice(r.blocks[0].start, r.blocks[0].end), 'one line continues here');
  });

  test('horizontal rules and blank lines do not become blocks', () => {
    const r = fi.markdownToBlocks('para\n\n---\n\n***\n\nnext\n');
    eq(r.blocks.map(b => b.kind), ['p', 'p']);
    eq(r.blocks.length, 2);
  });

  test('numbered lists are lists too', () => {
    const r = fi.markdownToBlocks('1. first\n2) second\n');
    eq(r.blocks.map(b => b.kind), ['li', 'li']);
    eq(r.text.slice(r.blocks[0].start, r.blocks[0].end), 'first');
  });

  test('an empty or trivial file is refused, not stored blank', () => {
    eq(fi.buildSavedContent('empty.md', ''), null);
    eq(fi.buildSavedContent('tiny.md', '# hi'), null);
    eq(fi.buildSavedContent('notes.pdf', 'lots and lots of text here to pass the length check'), null);
  });

  test('a real file produces the same record shape as a saved web page', () => {
    const sc = fi.buildSavedContent('Reading Notes.md',
      '# Reading Notes\n\nA paragraph long enough to be worth keeping around.\n\n- point one\n');
    ok(sc, 'should build a record');
    eq(sc.title, 'Reading Notes');
    eq(sc.siteName, 'Imported file');
    eq(sc.sourceFile, 'Reading Notes.md');
    eq(sc.chars, sc.text.length);
    ok(Array.isArray(sc.blocks) && sc.blocks.length >= 3, 'carries block structure');
    ok(sc.savedAt, 'carries a timestamp');
  });
};
