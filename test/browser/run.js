#!/usr/bin/env node
/*
 * Browser tests: the behaviour that only a real Chrome can prove.
 *
 * Covers capture, repaint including late-rendered content, the reader, and
 * backup round-trips. These are the checks that were previously throwaway
 * scripts in a temp directory.
 *
 *   node test/browser/run.js
 *
 * Set CHROME_PATH if Chrome is somewhere unusual. Uses an isolated profile and
 * a headless window, so it will not touch your browser.
 */
const path = require('path');
const { Browser, sleep } = require('./cdp.js');

const ARTICLE = 'https://en.wikipedia.org/wiki/Annotation';

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; failures.push({ name, message: err.message }); console.log(`  FAIL ${name}`); }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what || 'value'}: expected ${e}, got ${a}`);
}
function ok(v, what) { if (!v) throw new Error(`${what || 'value'}: expected truthy, got ${JSON.stringify(v)}`); }

(async () => {
  const browser = new Browser(path.join(__dirname, '..', '..'));
  const id = await browser.launch();
  console.log(`extension ${id}\n`);
  const sw = 'background/background.js';

  try {
    // The service worker needs to exist before anything else is meaningful.
    await test('service worker starts and owns the mutation handlers', async () => {
      await browser.openTab(ARTICLE);
      await sleep(2000);
      const r = await browser.eval(sw, `
        return JSON.stringify({
          hasListener: chrome.runtime.onMessage.hasListeners(),
          version: chrome.runtime.getManifest().version,
          commands: Object.keys(chrome.runtime.getManifest().commands),
        });`);
      const v = JSON.parse(r);
      ok(v.hasListener, 'message listener');
      ok(v.commands.includes('save-page'), 'save-page command');
    });

    await test('capturing a highlight stores it against the page URL', async () => {
      const r = await browser.eval(sw, `
        await chrome.storage.local.clear();
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        await chrome.tabs.reload(tab.id);
        await new Promise(r => setTimeout(r, 3500));
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async () => {
          const p = [...document.querySelectorAll('p')].find(x => x.offsetHeight > 0 && x.innerText.trim().length > 200);
          const tn = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.length > 70);
          const range = document.createRange(); range.setStart(tn, 0); range.setEnd(tn, 60);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          await new Promise(r => setTimeout(r, 900));
          document.querySelector('offline-notes-bubble').shadowRoot.getElementById('saveBtn').click();
          await new Promise(r => setTimeout(r, 1500));
          return document.querySelectorAll('.offline-notes-highlight').length;
        }});
        const s = await chrome.storage.local.get('offline_page_notes');
        const note = Object.values(s.offline_page_notes || {})[0];
        return JSON.stringify({ marks: res[0].result, stored: note ? note.highlights.length : 0, url: note && note.url });
      `);
      const v = JSON.parse(r);
      eq(v.marks, 1, 'marks painted');
      eq(v.stored, 1, 'highlights stored');
      eq(v.url, ARTICLE, 'stored against the page URL');
    });

    await test('a colour picked in the bubble is stored and painted', async () => {
      const r = await browser.eval(sw, `
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const p = [...document.querySelectorAll('p')].filter(x => x.offsetHeight > 0 && x.innerText.trim().length > 200)[1];
          const tn = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.length > 80);
          const range = document.createRange(); range.setStart(tn, 0); range.setEnd(tn, 60);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          await sleep(900);
          const sr = document.querySelector('offline-notes-bubble').shadowRoot;
          const swatches = sr.querySelectorAll('.sw b').length;
          sr.querySelector('.sw b[data-color="green"]').click();
          await sleep(250);
          sr.getElementById('saveBtn').click();
          await sleep(1800);
          const marks = [...document.querySelectorAll('.offline-notes-highlight')];
          const green = marks.find(m => m.getAttribute('data-color') === 'green');
          return { swatches, painted: !!green, bg: green && getComputedStyle(green).backgroundColor };
        }});
        await new Promise(r => setTimeout(r, 800));
        const s = await chrome.storage.local.get('offline_page_notes');
        const n = Object.values(s.offline_page_notes)[0];
        return JSON.stringify({ ui: res[0].result, colors: n.highlights.map(h => h.color) });
      `);
      const v = JSON.parse(r);
      eq(v.ui.swatches, 5, 'five colours offered');
      ok(v.ui.painted, 'the green highlight is painted');
      eq(v.ui.bg, 'rgb(197, 220, 192)', 'painted in the green from the palette');
      ok(v.colors.includes('green'), `stored colours: ${JSON.stringify(v.colors)}`);
    });

    await test('selecting inside a highlight offers Bold, and it persists', async () => {
      const r = await browser.eval(sw, `
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const mark = document.querySelector('.offline-notes-highlight');
          const tn = [...mark.childNodes].find(n => n.nodeType === 3);
          const range = document.createRange(); range.setStart(tn, 5); range.setEnd(tn, 20);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          await sleep(900);
          const sr = document.querySelector('offline-notes-bubble').shadowRoot;
          const out = {
            selected: range.toString(),
            saveBarHidden: sr.querySelector('.bar').classList.contains('off'),
            markBarShown: sr.getElementById('markBar').classList.contains('on'),
          };
          sr.getElementById('boldBtn').click();
          await sleep(2200);
          out.strongCount = document.querySelectorAll('.offline-notes-highlight strong').length;
          out.strongText = (document.querySelector('.offline-notes-highlight strong') || {}).textContent;
          return out;
        }});
        await new Promise(r => setTimeout(r, 800));
        const s = await chrome.storage.local.get('offline_page_notes');
        const n = Object.values(s.offline_page_notes)[0];
        return JSON.stringify({ ui: res[0].result, emphasis: n.highlights.map(h => h.emphasis || null) });
      `);
      const v = JSON.parse(r);
      // Selecting inside an existing highlight must not offer Save: that used
      // to store a second overlapping copy that could never be painted.
      ok(v.ui.saveBarHidden, 'save controls hidden inside a highlight');
      ok(v.ui.markBarShown, 'Bold and Note offered instead');
      ok(v.emphasis.some(e => e && e.length), `emphasis stored: ${JSON.stringify(v.emphasis)}`);
      ok(v.ui.strongCount > 0, 'emphasis painted as bold on the page');
      eq(v.ui.strongText, v.ui.selected, 'the bolded text is what was selected');
    });

    await test('saved highlights repaint on revisit', async () => {
      await browser.reload(ARTICLE);
      const r = await browser.eval(sw, `
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id },
          func: () => document.querySelectorAll('.offline-notes-highlight').length });
        const s = await chrome.storage.local.get('offline_page_notes');
        const n = Object.values(s.offline_page_notes)[0];
        return JSON.stringify({ marks: res[0].result, stored: n.highlights.length });
      `);
      const v = JSON.parse(r);
      eq(v.marks, v.stored, 'every stored highlight repaints');
    });

    await test('the in-page indicator reports what the page can show', async () => {
      const r = await browser.eval(sw, `
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
          const host = document.querySelector('offline-notes-presence');
          return host ? host.shadowRoot.getElementById('pl').textContent : null;
        }});
        return JSON.stringify(res[0].result);
      `);
      ok(JSON.parse(r), 'indicator should exist on a highlighted page');
    });

    await test('saving the article stores plain text with structure', async () => {
      const r = await browser.eval(sw, `
        const [tab] = await chrome.tabs.query({ url: '${ARTICLE}' });
        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id },
          func: async () => await chrome.runtime.sendMessage({ type: 'SAVE_PAGE_CONTENT' }) });
        const s = await chrome.storage.local.get('offline_page_notes');
        const note = Object.values(s.offline_page_notes)[0];
        const sc = note.savedContent || {};
        return JSON.stringify({
          ok: res[0].result && res[0].result.ok,
          chars: (sc.text || '').length,
          blocks: (sc.blocks || []).length,
          hasHtml: /<\\/?(div|p|img|script)\\b/i.test(sc.text || ''),
          hasEdit: /\\[edit\\]/i.test(sc.text || ''),
          id: note.id,
        });
      `);
      const v = JSON.parse(r);
      ok(v.ok, 'save reported success');
      ok(v.chars > 5000, 'article text stored');
      ok(v.blocks > 10, 'block structure recorded');
      eq(v.hasHtml, false, 'must be text, not markup');
      eq(v.hasEdit, false, 'no [edit] affordances');
      global.__pageId = v.id;
    });

    await test('the reader renders the article and locates highlights', async () => {
      const url = `chrome-extension://${id}/reader/reader.html?page=${global.__pageId}`;
      await browser.openTab(url);
      await sleep(3000);
      const r = await browser.eval('reader/reader.html?page', `
        await new Promise(r => setTimeout(r, 800));
        const body = document.getElementById('articleBody');
        const s = await chrome.storage.local.get('offline_page_notes');
        const stored = Object.values(s.offline_page_notes)[0].savedContent.text;
        const norm = t => t.replace(/\\s+/g, ' ').trim();
        return JSON.stringify({
          marks: body.querySelectorAll('mark.rd-mark').length,
          headings: body.querySelectorAll('h2,h3,h4').length,
          images: document.images.length,
          iframes: document.querySelectorAll('iframe').length,
          textMatches: norm(body.innerText).length === norm(stored).length,
          firstOffset: window.ReaderArticle.offsetOf(body, [...body.querySelector('p,h2,h3,li').childNodes].find(n => n.nodeType === 3), 0),
        });
      `);
      const v = JSON.parse(r);
      ok(v.marks >= 1, `highlights located in the snapshot (got ${v.marks})`);
      ok(v.headings > 0, 'structure rendered');
      eq(v.images, 0, 'no remote images');
      eq(v.iframes, 0, 'no embeds');
      eq(v.textMatches, true, 'rendered text matches stored text exactly');
      eq(v.firstOffset, 0, 'offsets measured from the body, not the header');
    });

    await test('highlighting in the reader saves to the source page', async () => {
      const r = await browser.eval('reader/reader.html?page', `
        const pre = Object.values((await chrome.storage.local.get('offline_page_notes')).offline_page_notes)[0].highlights.length;
        const body = document.getElementById('articleBody');
        const p = [...body.querySelectorAll('p')].find(el => !el.querySelector('mark') && el.textContent.length > 220);
        const tn = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.length > 120);
        const range = document.createRange(); range.setStart(tn, 5); range.setEnd(tn, 75);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise(r => setTimeout(r, 400));
        document.getElementById('selHighlight').click();
        await new Promise(r => setTimeout(r, 1800));
        const s = await chrome.storage.local.get('offline_page_notes');
        const notes = Object.values(s.offline_page_notes);
        return JSON.stringify({ pageNotes: notes.length, urls: notes.map(n => n.url), highlights: notes[0].highlights.length, before: pre });
      `);
      const v = JSON.parse(r);
      eq(v.pageNotes, 1, 'must not create a note for the extension URL');
      eq(v.urls[0], ARTICLE, 'attached to the source page');
      ok(v.highlights > v.before, `reader capture stored (${v.before} -> ${v.highlights})`);
    });

    await test('the reader shows colours and emphasis from the page', async () => {
      const r = await browser.eval('reader/reader.html?page', `
        await new Promise(r => setTimeout(r, 600));
        const body = document.getElementById('articleBody');
        const marks = [...body.querySelectorAll('mark.rd-mark')];
        return JSON.stringify({
          colors: marks.map(m => m.dataset.color),
          bgs: marks.map(m => getComputedStyle(m).backgroundColor),
          strongInText: body.querySelectorAll('mark.rd-mark strong').length,
          strongInRail: document.querySelectorAll('.rail-item-quote strong').length,
          railColors: [...document.querySelectorAll('.rail-item')].map(i => i.dataset.color),
        });
      `);
      const v = JSON.parse(r);
      ok(v.colors.includes('green'), `reader shows the picked colour: ${JSON.stringify(v.colors)}`);
      ok(v.bgs.includes('rgb(197, 220, 192)'), 'painted in the palette green');
      ok(v.strongInText > 0, 'emphasis rendered in the article text');
      ok(v.strongInRail > 0, 'emphasis rendered in the rail quote');
      ok(v.railColors.some(c => c && c !== 'yellow'), 'rail carries the colour too');
    });

    await test('bolding inside the reader persists to the same highlight', async () => {
      const r = await browser.eval('reader/reader.html?page', `
        const body = document.getElementById('articleBody');
        const before = document.querySelectorAll('mark.rd-mark strong').length;
        // Select inside a highlight that has no emphasis yet.
        const mark = [...body.querySelectorAll('mark.rd-mark')].find(m => !m.querySelector('strong'));
        const tn = [...mark.childNodes].find(n => n.nodeType === 3 && n.data.length > 20);
        const range = document.createRange(); range.setStart(tn, 2); range.setEnd(tn, 14);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise(r => setTimeout(r, 400));
        const newHidden = document.getElementById('selNew').hidden;
        const existingShown = !document.getElementById('selExisting').hidden;
        document.getElementById('selBold').click();
        await new Promise(r => setTimeout(r, 2000));
        const after = document.querySelectorAll('mark.rd-mark strong').length;
        const s = await chrome.storage.local.get('offline_page_notes');
        const n = Object.values(s.offline_page_notes)[0];
        return JSON.stringify({ newHidden, existingShown, before, after,
          withEmphasis: n.highlights.filter(h => h.emphasis && h.emphasis.length).length });
      `);
      const v = JSON.parse(r);
      ok(v.newHidden, 'Highlight is not offered inside an existing highlight');
      ok(v.existingShown, 'Bold is offered instead');
      ok(v.after > v.before, `emphasis painted (${v.before} -> ${v.after})`);
      ok(v.withEmphasis >= 2, `two highlights now carry emphasis (got ${v.withEmphasis})`);
    });

    await test('a selection dragged across paragraphs is located, not lost', async () => {
      const r = await browser.eval('reader/reader.html?page', `
        const body = document.getElementById('articleBody');
        const ps = [...body.querySelectorAll('p')].filter(el => !el.querySelector('mark') && el.textContent.length > 120);
        const first = ps[0], second = ps[1];
        const a = [...first.childNodes].find(n => n.nodeType === 3);
        const b = [...second.childNodes].find(n => n.nodeType === 3);
        // Span two separate block elements, which is what the user did.
        const range = document.createRange();
        range.setStart(a, Math.max(0, a.data.length - 40));
        range.setEnd(b, Math.min(40, b.data.length));
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        const selectionString = range.toString();
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise(r => setTimeout(r, 400));
        document.getElementById('selHighlight').click();
        await new Promise(r => setTimeout(r, 1800));
        const lostItems = document.querySelectorAll('.rail-item.is-lost').length;
        const marks = body.querySelectorAll('mark.rd-mark').length;
        const stored = Object.values((await chrome.storage.local.get('offline_page_notes')).offline_page_notes)[0];
        const newest = stored.highlights[stored.highlights.length - 1];
        return JSON.stringify({ selectionString, storedQuote: newest.text, lostItems, marks });
      `);
      const v = JSON.parse(r);
      // The selection really does arrive with the blank line missing...
      ok(!/\n/.test(v.selectionString), 'selection string has no block separator');
      // ...but what gets stored is the article slice, which keeps it.
      ok(/\n/.test(v.storedQuote), 'stored quote keeps the block separator');
      eq(v.lostItems, 0, 'nothing should land under "Not located"');
      ok(v.marks > 2, `cross-paragraph highlight painted (got ${v.marks} marks)`);
    });

    await test('simultaneous captures from two contexts all survive', async () => {
      await browser.openTab(`chrome-extension://${id}/sidebar/sidebar.html`);
      await sleep(2000);
      const burst = `
        const jobs = [];
        for (let i = 0; i < 6; i++) jobs.push(chrome.runtime.sendMessage({ type: 'SAVE_HIGHLIGHT',
          payload: { text: TAG + i, anchor: { exact: TAG + i, prefix: '', suffix: '' }, url: '${ARTICLE}', pageTitle: 'A' } }));
        const res = await Promise.all(jobs);
        return String(res.filter(r => r && r.ok).length);
      `;
      const [a, b] = await Promise.all([
        browser.eval('sidebar/sidebar.html', `const TAG = 'S';` + burst),
        browser.eval('reader/reader.html?page', `const TAG = 'R';` + burst),
      ]);
      eq([Number(a), Number(b)], [6, 6], 'both contexts acked');
      const r = await browser.eval(sw, `
        const s = await chrome.storage.local.get('offline_page_notes');
        const n = Object.values(s.offline_page_notes)[0];
        return String(n.highlights.filter(h => /^[RS]\\d$/.test(h.text)).length);
      `);
      eq(Number(r), 12, 'every concurrent write landed');
    });

    await test('a Markdown file imports and reads like a saved page', async () => {
      // Build the record in node with the real parser, then hand it to the
      // extension, which avoids nesting a markdown document inside a template.
      const fileImport = require('../../lib/file-import.js');
      const md = [
        '# Imported Reading Notes', '',
        'A first paragraph with **bold** text and a [link](https://example.com) in it.', '',
        '## A section heading', '',
        '- first point', '- second point', '',
        '> a quoted line worth keeping',
      ].join('\n');
      const sc = fileImport.buildSavedContent('Reading Notes.md', md);
      ok(sc, 'the parser produced a record');
      ok(!/\*\*/.test(sc.text), 'markdown syntax stripped from the readable text');
      const kinds = sc.blocks.map(b => b.kind);
      ok(kinds.includes('h2') && kinds.includes('li') && kinds.includes('quote'),
        `structure preserved: ${JSON.stringify(kinds)}`);

      const url = fileImport.importUrlFor('Reading Notes.md');
      const r = await browser.eval('sidebar/sidebar.html', `
        const payload = ${JSON.stringify({ url, sc })};
        const res = await chrome.runtime.sendMessage({ type: 'IMPORT_FILE',
          url: payload.url, pageTitle: payload.sc.title, savedContent: payload.sc });
        await new Promise(r => setTimeout(r, 700));
        const s = await chrome.storage.local.get('offline_page_notes');
        const note = Object.values(s.offline_page_notes).find(n => n.url === payload.url);
        return JSON.stringify({ ok: res && res.ok, id: note && note.id,
          title: note && note.pageTitle, highlights: note && note.highlights.length });
      `);
      const v = JSON.parse(r);
      ok(v.ok, 'import reported success');
      eq(v.title, 'Imported Reading Notes', 'title taken from the h1');
      eq(v.highlights, 0, 'a fresh import starts with no highlights');
      global.__importId = v.id;
    });

    await test('an imported file opens in the reader and can be highlighted', async () => {
      const url = `chrome-extension://${id}/reader/reader.html?page=${global.__importId}`;
      await browser.openTab(url);
      await sleep(3000);
      const r = await browser.eval(`page=${global.__importId}`, `
        await new Promise(r => setTimeout(r, 900));
        const body = document.getElementById('articleBody');
        const out = {
          headings: body.querySelectorAll('h2,h3').length,
          listItems: body.querySelectorAll('li').length,
          quotes: body.querySelectorAll('blockquote').length,
          hasOpenOriginal: !!document.querySelector('.doc-meta a'),
          meta: (document.querySelector('.doc-meta') || {}).textContent || '',
        };
        const p = [...body.querySelectorAll('p')].find(el => el.textContent.length > 40);
        const tn = [...p.childNodes].find(n => n.nodeType === 3 && n.data.length > 30);
        const range = document.createRange(); range.setStart(tn, 2); range.setEnd(tn, 25);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise(r => setTimeout(r, 400));
        document.getElementById('selHighlight').click();
        await new Promise(r => setTimeout(r, 1800));
        out.marks = body.querySelectorAll('mark.rd-mark').length;
        out.lost = document.querySelectorAll('.rail-item.is-lost').length;
        return JSON.stringify(out);
      `);
      const v = JSON.parse(r);
      ok(v.headings > 0, 'headings render as headings');
      ok(v.listItems >= 2, 'list items render as a list');
      ok(v.quotes >= 1, 'block quote renders');
      eq(v.hasOpenOriginal, false, 'no dead "Open original" link for an imported file');
      ok(/Reading Notes\.md/.test(v.meta), `meta names the source file: ${v.meta}`);
      eq(v.marks, 1, 'the highlight is painted in the imported document');
      eq(v.lost, 0, 'and it locates cleanly');
    });

    await test('every shared module reaches the page that loads it', async () => {
      // A duplicate top-level const in two classic scripts makes the second
      // fail to parse, silently: no error surfaces, the global is just gone.
      const r = await browser.eval('sidebar/sidebar.html', `
        const expected = ['HighlightStyle', 'HighlightOrder', 'FileImport', 'TextBlocks'];
        const missing = expected.filter(n => typeof window[n] === 'undefined');
        const classes = ['PageNoteExporter', 'CornellExporter', 'BackupManager', 'VaultWriter', 'PageNoteStorage'];
        const brokenClasses = classes.filter(n => {
          try { return typeof eval(n) !== 'function'; } catch (e) { return true; }
        });
        return JSON.stringify({ missing, brokenClasses });
      `);
      const v = JSON.parse(r);
      eq(v.missing, [], 'window globals present');
      eq(v.brokenClasses, [], 'classes defined');
    });

    await test('summary, order and both exports work together', async () => {
      const r = await browser.eval('sidebar/sidebar.html', `
        const s = await chrome.storage.local.get('offline_page_notes');
        const note = Object.values(s.offline_page_notes).find(n => n.highlights.length >= 2);
        // The summary is the fourth layer: the page in the user's own words.
        await chrome.runtime.sendMessage({ type: 'SET_SUMMARY', pageNoteId: note.id, summary: 'What this page is really about.' });
        await new Promise(r => setTimeout(r, 500));
        const fresh = await pageStorage.getById(note.id);

        const newest = window.HighlightOrder.sortHighlights(fresh.highlights, 'newest').map(h => h.id);
        const oldest = window.HighlightOrder.sortHighlights(fresh.highlights, 'oldest').map(h => h.id);

        const plain = new PageNoteExporter().exportPageNote(fresh, null);
        const cornell = new CornellExporter().export(fresh, null);
        return JSON.stringify({
          pageId: fresh.id,
          storedSummary: fresh.summary,
          orderReversed: newest.join() === oldest.slice().reverse().join(),
          plainHasSummary: plain.includes('## Summary'),
          plainHasBold: plain.indexOf('**') !== -1,
          cornellHasTable: cornell.includes('| Cue | Notes |'),
          cornellHasSummary: cornell.includes('What this page is really about.'),
          cornellRows: cornell.split(String.fromCharCode(10)).filter(l => l.startsWith('| ') && !l.startsWith('| Cue') && !l.startsWith('| ---')).length,
          highlights: fresh.highlights.length,
        });
      `);
      const v = JSON.parse(r);
      eq(v.storedSummary, 'What this page is really about.', 'summary persisted');
      ok(v.orderReversed, 'newest and oldest are exact reverses');
      ok(v.plainHasSummary, 'markdown export carries the summary');
      ok(v.plainHasBold, 'markdown export carries emphasis as bold');
      ok(v.cornellHasTable, 'Cornell emits a cue/notes table');
      ok(v.cornellHasSummary, 'Cornell carries the summary');
      eq(v.cornellRows, v.highlights, 'one Cornell row per highlight');
      global.__summaryPageId = v.pageId;
    });

    await test('the reader shows the summary above the article', async () => {
      await browser.openTab(`chrome-extension://${id}/reader/reader.html?page=${global.__summaryPageId}`);
      await sleep(3000);
      const v = JSON.parse(await browser.eval(`page=${global.__summaryPageId}`, `
        await new Promise(r => setTimeout(r, 800));
        const sum = document.querySelector('.doc-summary');
        const body = document.getElementById('articleBody');
        return JSON.stringify({
          present: !!sum,
          text: sum ? sum.textContent : null,
          aboveArticle: sum ? (sum.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : false,
        });
      `));
      ok(v.present, 'summary rendered in the reader');
      eq(v.text, 'What this page is really about.', 'summary text');
      ok(v.aboveArticle, 'and it sits above the article');
    });

    await test('the folder mirror writes the capture that triggered it', async () => {
      // Regression: the mirror used the sidebar's cached arrays, so a capture
      // could be omitted from disk while the bar still reported success.
      const r = await browser.eval('sidebar/sidebar.html', `
        // Stand in for a real directory: same handle interface, no picker.
        const opfs = await navigator.storage.getDirectory();
        const dir = await opfs.getDirectoryHandle('mirror-freshness-test', { create: true });
        vault.handle = dir;
        await vault._idb('readwrite', (st) => st.put(dir, vault.HANDLE_KEY));

        const countFiles = async () => { let n = 0; for await (const _ of dir.keys()) n++; return n; };
        await mirrorVault();
        const before = await countFiles();

        // A capture arriving now must reach disk even though the in-memory
        // lists have not been reloaded yet.
        const saved = await chrome.runtime.sendMessage({ type: 'SAVE_NOTE',
          note: { title: 'mirror freshness', content: 'written straight to storage', tags: [] } });
        await mirrorVault();
        const after = await countFiles();

        const notes = await storage.getAllNotes();
        const target = notes.find(n => n.title === 'mirror freshness');
        let onDisk = false;
        try { await dir.getFileHandle('note-' + target.id + '.md'); onDisk = true; } catch (e) { onDisk = false; }

        await vault.disconnect();
        return JSON.stringify({ ok: saved && saved.ok, before, after, onDisk });
      `);
      const v = JSON.parse(r);
      ok(v.ok, 'the note saved');
      ok(v.after > v.before, `a file was added (${v.before} -> ${v.after})`);
      ok(v.onDisk, 'the new note is on disk, not just counted');
    });

    await test('backup round-trips every key', async () => {
      const r = await browser.eval('sidebar/sidebar.html', `
        const b = new BackupManager();
        await chrome.storage.local.set({ offline_notes_theme: 'reader' });
        const exported = await b.export();
        const before = b.inspect(exported).summary;
        await chrome.storage.local.clear();
        await b.restore(exported.data);
        const after = b.inspect(await b.export()).summary;
        const theme = (await chrome.storage.local.get('offline_notes_theme')).offline_notes_theme;
        return JSON.stringify({ before, after, theme });
      `);
      const v = JSON.parse(r);
      eq(v.after.highlights, v.before.highlights, 'highlights survive a round trip');
      eq(v.after.pageNotes, v.before.pageNotes, 'page notes survive');
      eq(v.after.articles, v.before.articles, 'saved articles survive');
      eq(v.theme, 'reader', 'preferences survive');
    });

  } finally {
    await browser.close();
  }

  for (const f of failures) console.log(`\nFAIL  ${f.name}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
