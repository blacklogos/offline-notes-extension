/*
 * A very small HTML parser for the extraction tests.
 *
 * lib/page-content.js walks a DOM, and the repo has no dependencies, so the
 * tests build just enough of one: elements, text nodes, tagName, childNodes,
 * children and textContent. Not a browser; only the shape the walker touches.
 */
const VOID = new Set(['br', 'img', 'hr', 'meta', 'link', 'input']);

function makeElement(tag) {
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    childNodes: [],
    get children() { return this.childNodes.filter((n) => n.nodeType === 1); },
    get textContent() {
      return this.childNodes.map((n) => (n.nodeType === 3 ? n.textContent : n.textContent)).join('');
    },
  };
  return el;
}

function makeText(data) {
  return { nodeType: 3, textContent: data };
}

function parse(html) {
  const root = makeElement('body');
  const stack = [root];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const [full, tag, text] = m;
    if (text !== undefined) {
      stack[stack.length - 1].childNodes.push(makeText(text));
      continue;
    }
    const lower = tag.toLowerCase();
    if (full.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const el = makeElement(lower);
    stack[stack.length - 1].childNodes.push(el);
    if (!VOID.has(lower) && !full.endsWith('/>')) stack.push(el);
  }
  return root;
}

module.exports = parse;
