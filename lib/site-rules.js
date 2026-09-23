/*
 * Offline Notes — per-site on/off.
 *
 * Some pages are not for annotating: a bank, a web app, a page whose own UI
 * the bubble gets in the way of. Turning the extension off for a site keeps
 * everything already saved and simply stops it acting there: no bubble, no
 * repaint, no indicator, no capture.
 *
 * Matching is by hostname, because that is the unit people think in, and a
 * stored rule covers subdomains of itself so one entry for "example.com"
 * silences "app.example.com" too.
 */
(() => {
  const DISABLED_SITES_KEY = 'offline_notes_disabled_sites';

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
    catch (_) { return ''; }
  }

  function matches(host, rule) {
    if (!host || !rule) return false;
    return host === rule || host.endsWith('.' + rule);
  }

  async function loadDisabledSites() {
    try {
      const r = await chrome.storage.local.get(DISABLED_SITES_KEY);
      const list = r[DISABLED_SITES_KEY];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  async function isDisabledForUrl(url) {
    const host = hostOf(url);
    if (!host) return false;
    return (await loadDisabledSites()).some((rule) => matches(host, rule));
  }

  /** Turn the extension off for a URL's site. Returns the rule stored. */
  async function disableSite(url) {
    const host = hostOf(url);
    if (!host) throw new Error('That page has no site to turn off');
    const list = await loadDisabledSites();
    if (!list.includes(host)) list.push(host);
    await chrome.storage.local.set({ [DISABLED_SITES_KEY]: list });
    return host;
  }

  /** Turn it back on, including via a parent rule that was covering this host. */
  async function enableSite(url) {
    const host = hostOf(url);
    const list = await loadDisabledSites();
    const next = list.filter((rule) => !matches(host, rule));
    await chrome.storage.local.set({ [DISABLED_SITES_KEY]: next });
    return host;
  }

  const api = { DISABLED_SITES_KEY, hostOf, matches, loadDisabledSites, isDisabledForUrl, disableSite, enableSite };
  if (typeof window !== 'undefined') window.SiteRules = api;
  if (typeof self !== 'undefined' && typeof window === 'undefined') Object.assign(self, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
