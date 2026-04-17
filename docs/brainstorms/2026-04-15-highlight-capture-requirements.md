---
date: 2026-04-15
topic: highlight-capture
---

# Highlight Capture (Save.day-style) for Offline Notes

## Problem Frame

Today the extension is a closed-loop notebook: notes are only created from the popup or sidebar by typing. Users browsing the web have no way to capture a quote, fact, or reference into Offline Notes without copy-pasting into a popup, which loses the source URL and context. The user wants the same first-class experience Save.day offers — select text on any page, save it in one gesture, and have those highlights re-appear visually when revisiting the page — while preserving the extension's offline-only, local-storage-only character.

## Requirements

**Capture**
- R1. Selecting text on any web page surfaces a small floating action bubble next to the selection with a single primary action (save highlight). The bubble dismisses on click-away or a second selection.
- R2. The browser right-click menu, when text is selected, shows a "Save highlight to Offline Notes" entry that performs the same save.
- R3. A new keyboard shortcut (suggested `Alt+H`, registered alongside the existing `Alt+N` / `Alt+Shift+N`) saves the current selection without requiring the bubble or menu.
- R4. Each saved highlight stores at minimum: the selected text, the page's canonical URL, the page title, and a capture timestamp. Long selections are stored verbatim (no truncation).
- R5. Saving a highlight gives immediate, non-modal visual confirmation in-page (e.g. brief check on the bubble or a transient toast).

**Storage Model**
- R6. Highlights aggregate into one auto-created "page note" per unique URL. The first highlight on a URL creates the page note; subsequent highlights append to it. Page notes have title (defaulting to page title, user-editable), source URL, and an ordered list of highlights.
- R7. Page notes are a distinct entity from manual notes and never appear mixed into the existing notes list.
- R8. URL canonicalization rules (which query params to strip, hash handling) are a deliberate decision deferred to planning; the requirement is that visiting the "same logical page" twice produces one page note, not two.

**Re-paint on Revisit**
- R9. When a user revisits a URL that has saved highlights, the previously highlighted text is re-painted in place on the page (yellow `<mark>` style, consistent with the bubble's visual identity).
- R10. Anchor matching is best-effort. When a highlight cannot be located on the current DOM (page changed, content removed), it is silently skipped — the stored highlight remains in the page note and is still visible in the sidebar; it is simply not re-painted in-page.
- R11. Re-paint runs without user gesture on page load, which requires broad host access. The install-time permission warning is an accepted cost.

**Sidebar Surface**
- R12. The sidebar gains a second top-level tab/section "Pages" alongside the existing notes view. Pages lists page notes sorted by most-recently-highlighted, each showing page title, host, highlight count, and last-capture time.
- R13. Opening a page note shows its highlights as a readable, ordered list with timestamps, with per-highlight actions: copy as markdown quote, jump to the page (opens URL and scrolls to the highlight), delete.
- R14. The extension toolbar icon shows a numeric badge on tabs that have saved highlights for the current URL ("3" = three highlights stored for this page).

**Privacy and Excluded Surfaces**
- R15. The content script does not run on `chrome://`, `chrome-extension://`, or `file://` URLs. Behaviour on incognito windows is a deferred decision.
- R16. No network calls. All capture, anchor data, and re-paint logic stays local, consistent with the existing offline-only posture.

## Success Criteria

- A user can browse to an article, highlight three sentences from different paragraphs, close the tab, reopen the URL a week later, and see all three sentences re-painted on the page and listed in the Pages tab — without ever opening the popup.
- The bubble feels like part of the extension's visual language, not a third-party adware overlay (this is the gating quality bar — see the aesthetic pass below).
- Existing manual notes workflow is unchanged; users who never highlight see no new clutter in their Notes list.
- Install-time permission warning does not cause user-reported uninstalls in informal testing among 3-5 trial users.

## Scope Boundaries

- Not a full annotation tool: no per-highlight comments, no colours other than the default, no shared/multi-user highlights, no exporting highlights to third parties.
- Not selection-aware beyond text: no image capture, no PDF support, no iframe traversal.
- Re-paint is best-effort only — no fuzzy/semantic matching, no reflow tracking, no SPA route-change detection beyond what comes for free with the page-load lifecycle.
- The Pages tab does not deduplicate or merge across canonicalization rule changes after the fact.

## Key Decisions

- **Destination = auto page note per URL** (chosen over append-to-active-note, prompt-on-capture, or both). Rationale: matches Save.day's mental model, requires no per-capture user choice, naturally groups highlights by source.
- **Trigger = bubble + context menu + keyboard shortcut, all three.** Rationale: covers discovery (bubble), discoverability through OS conventions (right-click), and power-user speed (shortcut). Cost is the bubble's visual polish, which folds into the upcoming aesthetic pass.
- **Re-paint on revisit with sidebar indicator.** Rationale: this is the headline differentiator; without it the feature is "another web clipper". Accepting the engineering cost of DOM anchors + per-tab badge management.
- **Page notes as a separate entity with their own sidebar tab.** Rationale: keeps the existing handwritten-notes UX uncluttered for users who accumulate hundreds of auto-pages; lets each tab evolve its own UX (Pages benefits from URL/host columns; Notes does not).
- **Broad `host_permissions: ["<all_urls>"]` accepted over `activeTab`.** Rationale: re-paint on load needs to run before user gesture, which `activeTab` cannot satisfy. Trade-off acknowledged in R11.

## Dependencies / Assumptions

- Chrome's `scripting`, `contextMenus`, and `<all_urls>` host permissions will be added to `manifest.json`. Verified against current `manifest.json`: only `storage`, `sidePanel`, `tabs` are present today, so all three are net-new.
- A new `commands` entry (default `Alt+H`) will be registered. The existing `commands` block already has two entries; assumption is that adding a third keeps within Chrome's 4-shortcut suggested-default limit.
- Storage stays in `chrome.storage.local`. Assumption: page notes + per-highlight anchor metadata fit comfortably within local storage's effective ceiling for typical use (hundreds of pages, tens of highlights each). Worth re-checking during planning if heavy users are a target.
- The current `lib/storage.js` `StorageManager` will gain a parallel surface for page notes (likely a sibling class or namespaced methods) — exact shape deferred to planning.

## Outstanding Questions

### Resolve Before Planning

(none — product decisions are settled)

### Deferred to Planning

- [Affects R8][Technical] URL canonicalization rules: which query params strip (likely `utm_*`, `fbclid`, `gclid` allowlist or denylist?), hash handling (treat `#section` as same page or different?), trailing-slash normalization, case sensitivity for path.
- [Affects R9, R10][Needs research] DOM anchor strategy: evaluate whether a vendored library (e.g. `dom-anchor-text-quote` family, `rangy`) is justified vs. a hand-rolled CSS-path + text-offset + leading/trailing-context anchor. Weighs against the extension's "vendor only what's necessary" posture (already vendoring `html2canvas`).
- [Affects R14][Technical] Per-tab badge management: tab/URL change detection, debouncing on SPA navigations, and which Chrome API surface (`chrome.tabs.onUpdated` vs `webNavigation`) avoids extra permissions.
- [Affects R15][User decision] Incognito behaviour: opt-out by default, opt-in via extension setting, or always-on. Likely opt-out by default but worth one explicit user call before shipping.
- [Affects R6, R12][Technical] Storage layout for page notes: extend the existing `offline_notes` array with a discriminator field, or introduce a sibling key (`offline_page_notes`) with its own access surface. Migration impact on existing users is near-zero (no existing page notes), so this is a code-organisation question, not a data-migration one.
- [Affects R13][Technical] "Jump to highlight" round-trip: how the sidebar tells a content script to scroll-and-flash a specific anchor (message via `chrome.tabs.sendMessage`, anchor ID in URL hash, or stored "pending-scroll" the content script picks up on next load).

## Next Steps

A second brainstorm is owed for the **aesthetic / UI / UX refresh**. That brainstorm should treat the new in-page bubble, the badge, the Pages tab, and the existing popup/sidebar surfaces as one coherent visual system rather than improving them in isolation. The bubble in particular is the only piece of this extension that appears on third-party pages, so its visual identity sets the bar.

-> Resume `/compound-engineering:ce-brainstorm` for the aesthetic pass, then `/compound-engineering:ce-plan` once both requirement docs exist.
