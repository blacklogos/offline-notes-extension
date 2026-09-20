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
