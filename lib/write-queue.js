/*
 * Offline Notes — serialized storage writes.
 *
 * chrome.storage.local has no transactions, and every mutation here is a
 * read-modify-write over an entire collection. Two writes issued in the same
 * tick both read the old collection, and the second overwrites the first.
 * Measured before this existed: eight simultaneous appends left two
 * highlights. The user is told nothing.
 *
 * This queue makes mutations run one after another inside a context. It is
 * only half the answer: an in-memory chain cannot serialize across the
 * service worker, the sidebar and the reader. The other half is that each
 * collection has exactly one writing context (the service worker), with other
 * surfaces asking it to write via messages.
 */
class WriteQueue {
  constructor() {
    this.tail = Promise.resolve();
  }

  /**
   * Run `fn` once every previously queued job has settled.
   * A failing job must not break the chain for the jobs behind it, so the
   * stored tail swallows rejections while the caller still sees them.
   */
  run(fn) {
    const result = this.tail.then(fn, fn);
    this.tail = result.then(() => {}, () => {});
    return result;
  }
}

// One queue per collection: writes to notes need not wait behind page notes.
const noteWriteQueue = new WriteQueue();
const pageWriteQueue = new WriteQueue();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WriteQueue, noteWriteQueue, pageWriteQueue };
}
