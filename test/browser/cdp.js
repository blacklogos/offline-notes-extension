/*
 * Minimal Chrome DevTools Protocol client for the browser tests.
 *
 * No dependencies, matching the rest of the repo. Launches an isolated Chrome
 * with the extension loaded, then evaluates code inside specific targets
 * (service worker, sidebar, reader, a web page).
 *
 * Extensions cannot be loaded with --load-extension any more, so the extension
 * is installed over CDP with Extensions.loadUnpacked, which needs
 * --enable-unsafe-extension-debugging.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9333);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch (_) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`Chrome did not expose a debugging port on ${PORT}`);
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    ws.onerror = () => reject(new Error('CDP socket error'));
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res) => {
          const i = ++id;
          pending.set(i, res);
          ws.send(JSON.stringify({ id: i, method, params }));
        });
      },
      close: () => ws.close(),
    });
  });
}

class Browser {
  constructor(extensionPath) {
    this.extensionPath = extensionPath;
    this.profile = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-notes-test-'));
  }

  async launch() {
    this.proc = spawn(CHROME, [
      `--user-data-dir=${this.profile}`,
      `--remote-debugging-port=${PORT}`,
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      'about:blank',
    ], { stdio: 'ignore', detached: false });
    await waitForPort();

    const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    this.browser = await connect(version.webSocketDebuggerUrl);
    const res = await this.browser.send('Extensions.loadUnpacked', { path: this.extensionPath });
    if (!res.result || !res.result.id) throw new Error('Could not load the extension: ' + JSON.stringify(res));
    this.extensionId = res.result.id;
    return this.extensionId;
  }

  async targets() {
    return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  }

  /** Wait until a target whose url contains `match` exists, then return it. */
  async waitForTarget(match, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const t = (await this.targets()).find((x) => x.url.includes(match));
      if (t && t.webSocketDebuggerUrl) return t;
      await sleep(200);
    }
    throw new Error(`No target matching "${match}"`);
  }

  async openTab(url) {
    await this.browser.send('Target.createTarget', { url });
    return this.waitForTarget(url.split('#')[0].slice(0, 60));
  }

  /** Evaluate an async function body inside a target, returning its value. */
  async eval(match, body, { bringToFront = false } = {}) {
    const target = await this.waitForTarget(match);
    const client = await connect(target.webSocketDebuggerUrl);
    try {
      await client.send('Runtime.enable');
      if (bringToFront) { await client.send('Page.enable'); await client.send('Page.bringToFront'); }
      const r = await client.send('Runtime.evaluate', {
        expression: `(async () => { ${body} })()`,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (r.result.exceptionDetails) {
        const d = r.result.exceptionDetails;
        throw new Error('In-page error: ' + (d.exception?.description || d.text));
      }
      return r.result.result.value;
    } finally {
      client.close();
    }
  }

  async reload(match) {
    const target = await this.waitForTarget(match);
    const client = await connect(target.webSocketDebuggerUrl);
    try {
      await client.send('Page.enable');
      await client.send('Page.bringToFront');
      await client.send('Page.reload', {});
      await sleep(2500);
    } finally { client.close(); }
  }

  async close() {
    try { this.browser && this.browser.close(); } catch (_) {}
    try { this.proc && this.proc.kill('SIGTERM'); } catch (_) {}
    await sleep(400);
    try { fs.rmSync(this.profile, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { Browser, sleep, PORT };
