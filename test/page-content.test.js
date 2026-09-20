/*
 * Article extraction: the flat text and the block offsets that describe it.
 *
 * Runs the real extractor against a minimal DOM stub, since the module is
 * written for a browser. Covers three bugs found by hand: [edit] links leaking
 * into the text, container elements recording ranges that overlapped their
 * children (rendering the article 50% longer), and post-pass cleanups shifting
 * every recorded offset.
 */
module.exports = ({ test, eq, ok, root }) => {
  const fs = require('fs');
  const src = fs.readFileSync(root + '/lib/text-blocks.js', 'utf8');

  // Minimal DOM: enough for the extractor's walk (elements, text nodes, tags).
  function makeDoc(html) {
    const parse = require(root + '/test/tiny-dom.js');
    return parse(html);
  }

  const NODE = { TEXT_NODE: 3, ELEMENT_NODE: 1 };

  // Run the module with a stubbed document and capture its internal builder,
  // which is the unit under test.
  const extractBlocks = (html) => {
    const doc = makeDoc(html);
    const stubDoc = { implementation: { createHTMLDocument: () => ({ body: doc }) } };
    const captured = {};
    const patched = src.replace(
      'const api = { htmlToBlocks',
      'captured.htmlToBlocks = htmlToBlocks; const api = { htmlToBlocks'
    );
    new Function('window', 'document', 'Node', 'console', 'captured', patched)(
      {}, stubDoc, NODE, console, captured
    );
    return captured.htmlToBlocks(html);
  };

  test('paragraphs become separate blocks', () => {
    const { text, blocks } = extractBlocks('<p>One two.</p><p>Three four.</p>');
    eq(text, 'One two.\n\nThree four.');
    eq(blocks.map(b => b.kind), ['p', 'p']);
  });

  test('block offsets point at the right slice of the text', () => {
    const { text, blocks } = extractBlocks('<h2>Heading</h2><p>Body text.</p>');
    eq(text.slice(blocks[0].start, blocks[0].end), 'Heading');
    eq(text.slice(blocks[1].start, blocks[1].end), 'Body text.');
  });

  test('heading levels are preserved', () => {
    const { blocks } = extractBlocks('<h1>A</h1><h3>B</h3><li>C</li>');
    eq(blocks.map(b => b.kind), ['h2', 'h3', 'li']);
  });

  test('a container does not overlap its child blocks', () => {
    const { text, blocks } = extractBlocks('<div><p>Alpha.</p><p>Beta.</p></div>');
    eq(text, 'Alpha.\n\nBeta.');
    eq(blocks.length, 2, 'only the two real paragraphs');
    const covered = blocks.reduce((n, b) => n + (b.end - b.start), 0);
    ok(covered <= text.length, 'blocks must not cover more than the text');
  });

  test('section [edit] links are dropped', () => {
    const { text } = extractBlocks('<p>Body.</p><span>[<a>edit</a>]</span><p>More.</p>');
    ok(!/\[edit\]/i.test(text), `expected no [edit], got: ${text}`);
  });

  test('punctuation spacing is tightened', () => {
    const { text } = extractBlocks('<p>book pages <a>.</a> see <span>[</span> 1 <span>]</span></p>');
    ok(!text.includes(' .'), `space before period: ${text}`);
  });

  test('script and style content never reaches the text', () => {
    const { text } = extractBlocks('<p>Keep.</p><script>var x=1;</script><style>.a{}</style>');
    eq(text, 'Keep.');
  });
};
