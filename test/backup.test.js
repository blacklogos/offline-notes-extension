/*
 * Backup and restore.
 *
 * Guards the failure where a "full" export quietly omitted keys: the first
 * version left out every page note, so a trusted backup contained no
 * highlights at all. These tests assert the shape and the validation, with
 * chrome.storage stubbed.
 */
module.exports = async ({ test, eq, ok, root }) => {
  const { BackupManager, BACKUP_KEYS } = require(root + '/lib/backup.js');

  const makeChrome = (initial = {}) => {
    let store = { ...initial };
    return {
      store: () => store,
      api: {
        // Restore now goes through the worker, which holds both write queues.
        runtime: {
          sendMessage: async (msg) => {
            if (msg.type !== 'RESTORE_BACKUP') return { ok: false, error: 'unexpected' };
            Object.assign(store, msg.payload);
            return { ok: true, result: Object.keys(msg.payload) };
          },
        },
        storage: {
          local: {
            get: async (keys) => {
              const out = {};
              for (const k of [].concat(keys)) if (store[k] !== undefined) out[k] = store[k];
              return out;
            },
            set: async (obj) => { Object.assign(store, obj); },
          },
        },
      },
    };
  };

  const sample = {
    offline_notes: [{ id: 'n1', title: 'A', content: 'x', tags: [] }],
    offline_page_notes: {
      p1: { id: 'p1', url: 'https://e.com/a', pageTitle: 'A', highlights: [{ id: 'h1', text: 'q', comment: 'c' }], savedContent: { text: 'article' } },
      p2: { id: 'p2', url: 'https://e.com/b', pageTitle: 'B', highlights: [] },
    },
    offline_notes_settings: { theme: 'x' },
    offline_notes_theme: 'reader',
    offline_notes_reader_prefs: { sizeIdx: 3 },
  };

  const results = {};
  await (async () => {
    const c = makeChrome(sample);
    global.chrome = c.api;
    const b = new BackupManager();
    const exported = await b.export();
    results.exportedKeys = Object.keys(exported.data).sort();
    results.inspect = b.inspect(exported);

    // Round trip into an empty store.
    const empty = makeChrome({});
    global.chrome = empty.api;
    const b2 = new BackupManager();
    await b2.restore(exported.data);
    results.restoredKeys = Object.keys(empty.store()).sort();
    results.restoredHighlights = empty.store().offline_page_notes.p1.highlights.length;
    results.restoredTheme = empty.store().offline_notes_theme;
  })();

  test('export carries every key the extension owns', () => {
    eq(results.exportedKeys, BACKUP_KEYS.slice().sort(), 'exported keys');
  });

  test('export includes preferences, not just notes', () => {
    ok(results.exportedKeys.includes('offline_notes_theme'), 'theme');
    ok(results.exportedKeys.includes('offline_notes_reader_prefs'), 'reader prefs');
  });

  test('inspect summarizes what a restore would bring back', () => {
    const s = results.inspect.summary;
    eq([s.notes, s.pageNotes, s.highlights, s.articles], [1, 2, 1, 1], 'summary counts');
    ok(s.includesPreferences, 'should report preferences present');
  });

  test('round trip restores highlights and preferences', () => {
    eq(results.restoredHighlights, 1, 'highlights survive');
    eq(results.restoredTheme, 'reader', 'theme survives');
  });

  test('rejects a file that is not a backup', () => {
    const b = new BackupManager();
    eq(b.inspect({ hello: 'world' }).valid, false);
    eq(b.inspect(null).valid, false);
    eq(b.inspect('nonsense').valid, false);
  });

  test('rejects malformed collections', () => {
    const b = new BackupManager();
    const bad = b.inspect({ format: 'offline-notes-backup', data: { offline_notes: 'not an array' } });
    eq(bad.valid, false);
    ok(bad.errors.length > 0, 'should explain why');
  });

  test('accepts the older export shape', () => {
    const b = new BackupManager();
    const old = b.inspect({ notes: [{ id: 'n' }], pageNotes: { p: { highlights: [{ id: 'h' }] } }, settings: {} });
    eq(old.valid, true);
    eq([old.summary.notes, old.summary.highlights], [1, 1], 'legacy counts');
  });

  test('a backup missing a key does not wipe that key', async () => {
    const c = makeChrome({ offline_notes_theme: 'reader', offline_notes: [] });
    global.chrome = c.api;
    const b = new BackupManager();
    await b.restore({ offline_notes: [{ id: 'x' }] });     // no theme in this file
    eq(c.store().offline_notes_theme, 'reader', 'untouched key');
  });


  test('a legacy backup omitting a collection does not erase it', async () => {
    const c = makeChrome({ offline_notes: [{ id: 'keep' }], offline_page_notes: { p: { id: 'p', highlights: [] } } });
    global.chrome = c.api;
    const b = new BackupManager();
    // A notes-only legacy file must leave page notes alone.
    const check = b.inspect({ notes: [{ id: 'restored' }] });
    eq(check.valid, true, 'legacy file accepted');
    await b.restore(check.data);
    eq(Object.keys(c.store().offline_page_notes).length, 1, 'page notes untouched');
    eq(c.store().offline_notes.map(n => n.id), ['restored'], 'notes replaced');
  });

  test('invalid records are rejected before anything is written', async () => {
    const c = makeChrome({ offline_notes: [{ id: 'original' }] });
    global.chrome = c.api;
    const b = new BackupManager();
    const bad = b.inspect({ format: 'offline-notes-backup', data: { offline_notes: [null] } });
    eq(bad.valid, false, 'a null record is refused');
    ok(bad.errors.length > 0, 'and explained');
    eq(c.store().offline_notes.map(n => n.id), ['original'], 'nothing was written');
  });

  test('a page note with malformed highlights is rejected', () => {
    global.chrome = makeChrome({}).api;
    const b = new BackupManager();
    eq(b.inspect({ format: 'offline-notes-backup',
      data: { offline_page_notes: { p: { id: 'p', highlights: 'nope' } } } }).valid, false);
    eq(b.inspect({ format: 'offline-notes-backup',
      data: { offline_page_notes: { p: { id: 'p', highlights: [null] } } } }).valid, false);
  });

  delete global.chrome;
};
