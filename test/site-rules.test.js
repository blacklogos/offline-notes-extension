/*
 * Per-site on/off. Turning a site off must stop the extension acting there
 * without touching anything already saved.
 */
module.exports = async ({ test, eq, ok, root }) => {
  const sr = require(root + '/lib/site-rules.js');

  const withStore = (initial = {}) => {
    let store = { ...initial };
    global.chrome = { storage: { local: {
      get: async (k) => (store[k] !== undefined ? { [k]: store[k] } : {}),
      set: async (o) => { Object.assign(store, o); },
    } } };
    return () => store;
  };

  test('hostname is taken from the URL, without www', () => {
    eq(sr.hostOf('https://www.example.com/a/b?c=1'), 'example.com');
    eq(sr.hostOf('https://app.example.com/'), 'app.example.com');
    eq(sr.hostOf('not a url'), '');
  });

  test('a rule covers its subdomains but not a lookalike', () => {
    ok(sr.matches('app.example.com', 'example.com'), 'subdomain');
    ok(sr.matches('example.com', 'example.com'), 'exact');
    ok(!sr.matches('notexample.com', 'example.com'), 'suffix but not a subdomain');
    ok(!sr.matches('example.com.evil.test', 'example.com'), 'prefix match is not enough');
  });

  test('disabling a site makes its pages disabled', async () => {
    const store = withStore();
    await sr.disableSite('https://www.example.com/page');
    eq(store()[sr.DISABLED_SITES_KEY], ['example.com']);
    eq(await sr.isDisabledForUrl('https://example.com/other'), true);
    eq(await sr.isDisabledForUrl('https://app.example.com/other'), true);
    eq(await sr.isDisabledForUrl('https://elsewhere.com/'), false);
  });

  test('disabling twice does not duplicate the rule', async () => {
    const store = withStore();
    await sr.disableSite('https://example.com/a');
    await sr.disableSite('https://example.com/b');
    eq(store()[sr.DISABLED_SITES_KEY].length, 1);
  });

  test('enabling removes a parent rule that was covering the host', async () => {
    const store = withStore({ [sr.DISABLED_SITES_KEY]: ['example.com', 'other.com'] });
    await sr.enableSite('https://app.example.com/x');
    eq(store()[sr.DISABLED_SITES_KEY], ['other.com'], 'only the covering rule goes');
    eq(await sr.isDisabledForUrl('https://app.example.com/x'), false);
  });

  test('a page with no host is never disabled', async () => {
    withStore({ [sr.DISABLED_SITES_KEY]: ['example.com'] });
    eq(await sr.isDisabledForUrl('about:blank'), false);
    eq(await sr.isDisabledForUrl(''), false);
  });

  test('a broken store does not accidentally disable everything', async () => {
    global.chrome = { storage: { local: {
      get: async () => { throw new Error('storage down'); },
      set: async () => {},
    } } };
    eq(await sr.isDisabledForUrl('https://example.com/'), false);
  });

  delete global.chrome;
};
