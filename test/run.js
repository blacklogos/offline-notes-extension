#!/usr/bin/env node
/*
 * Offline Notes — test runner.
 *
 * Plain node, no dependencies, matching a repo with no build step. Covers the
 * pure logic where the subtle bugs actually lived: quote location against a
 * reshaped snapshot, article extraction, and write serialization. Browser
 * behaviour (repaint, the bubble, the reader UI) is not covered here and still
 * needs a real Chrome.
 *
 *   node test/run.js
 */
const path = require('path');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
  }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what || 'value'}: expected ${e}, got ${a}`);
}

function ok(value, what) {
  if (!value) throw new Error(`${what || 'value'}: expected truthy, got ${JSON.stringify(value)}`);
}

const suites = ['text-locate.test.js', 'page-content.test.js', 'write-queue.test.js', 'backup.test.js', 'highlight-style.test.js', 'file-import.test.js'];
const api = { test, eq, ok, root: path.join(__dirname, '..') };

(async () => {
  for (const s of suites) await require(path.join(__dirname, s))(api);

  for (const f of failures) console.log(`FAIL  ${f.name}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
