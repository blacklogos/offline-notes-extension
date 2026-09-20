/*
 * Write serialization.
 *
 * Guards the failure that lost six of eight highlights: concurrent
 * read-modify-write over one collection, where the last writer wins.
 */
module.exports = async ({ test, eq, ok, root }) => {
  const { WriteQueue } = require(root + '/lib/write-queue.js');

  // A collection behind an async read and write, like chrome.storage.local.
  const makeStore = () => {
    let data = [];
    return {
      read: () => new Promise(r => setTimeout(() => r(data.slice()), 1)),
      write: (next) => new Promise(r => setTimeout(() => { data = next; r(); }, 1)),
      get length() { return data.length; },
    };
  };

  const appendUnqueued = async (store, item) => {
    const cur = await store.read();
    cur.push(item);
    await store.write(cur);
  };

  const results = {};

  await (async () => {
    const store = makeStore();
    await Promise.all([...Array(8).keys()].map(i => appendUnqueued(store, i)));
    results.unqueued = store.length;
  })();

  await (async () => {
    const store = makeStore();
    const q = new WriteQueue();
    await Promise.all([...Array(8).keys()].map(i => q.run(() => appendUnqueued(store, i))));
    results.queued = store.length;
  })();

  await (async () => {
    // A failing job must not stall or break the jobs behind it.
    const store = makeStore();
    const q = new WriteQueue();
    const settled = await Promise.allSettled([
      q.run(() => appendUnqueued(store, 'a')),
      q.run(() => Promise.reject(new Error('boom'))),
      q.run(() => appendUnqueued(store, 'b')),
    ]);
    results.afterFailure = store.length;
    results.rejectionSurfaced = settled[1].status === 'rejected';
  })();

  test('unqueued concurrent appends lose writes (the bug)', () => {
    ok(results.unqueued < 8, `expected loss without a queue, got ${results.unqueued}/8`);
  });

  test('queued concurrent appends keep every write', () => {
    eq(results.queued, 8, 'queued appends');
  });

  test('a failing job does not break the queue', () => {
    eq(results.afterFailure, 2, 'writes either side of a failure');
  });

  test('a failing job still rejects for its own caller', () => {
    ok(results.rejectionSurfaced, 'rejection should reach the caller');
  });
};
