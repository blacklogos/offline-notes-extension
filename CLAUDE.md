# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome Extension (Manifest V3) for offline note-taking. All data stays in `chrome.storage.local` — no build step, no bundler, no framework. Vanilla JS + HTML + CSS loaded directly by Chrome.

## Development workflow

No build/lint/test commands. Iteration loop:

1. Load unpacked from `chrome://extensions/` (Developer mode on) pointed at the repo root.
2. Edit files in place.
3. Hit the reload button on the extension card in `chrome://extensions/` to pick up changes (required for `background/background.js` and `manifest.json`; popup/sidebar HTML usually refreshes on reopen).
4. For popup/sidebar JS changes, close and reopen the popup or side panel.

`node test/run.js` runs the logic tests: quote location, article extraction,
write serialization and backup validation. No dependencies.

`node test/browser/run.js` runs the browser tests against a real headless
Chrome on a throwaway profile, loading the extension over CDP
(`Extensions.loadUnpacked`, which is why it passes
`--enable-unsafe-extension-debugging`; `--load-extension` no longer works).
`test/browser/cdp.js` is the client.

The remaining harnesses are manual, opened directly in a browser:
- `test-image-generation.html` — exercises `lib/image-generator.js` + `lib/templates.js` via html2canvas.
- `test-templates.html` — visual preview of the 5 image templates.
- `generate-icons.html` — one-off tool to regenerate `images/` icons.

Chrome 114+ is required (Side Panel API).

## Architecture

Three entry points, all sharing the `lib/` modules via plain `<script>` tags (no ES modules in popup/sidebar; the background is declared `"type": "module"` but currently imports nothing):

- **`popup/`** — `action.default_popup`. Quick-capture UI bound to `Alt+N`.
- **`sidebar/`** — `side_panel.default_path`. Full note manager (list, search, tag filter, editor, export). Bound to `Alt+Shift+N`.
- **`background/background.js`** — service worker, and the **single writing context** for both collections. Routes the `chrome.commands` shortcuts (`quick-note`, `open-sidebar`, `save-highlight`, `save-page`), registers the context menus, keeps the per-tab badge, captures readable page text, and owns every mutation. Other surfaces read `chrome.storage.local` directly but send a message to mutate (`SAVE_HIGHLIGHT`, `UPDATE_HIGHLIGHT_COMMENT`, `SAVE_NOTE`, `DELETE_PAGE_NOTE`, …). That is deliberate: mutations are read-modify-write over a whole collection, and an in-memory queue cannot serialize across separate JS contexts.
- **`reader/`** — `reader/reader.html?page=<pageNoteId>`, opened in a tab. Renders a saved article with its highlights, and captures new ones against the source page note.

Shared library layer (`lib/`), each file defines a class on the global scope:

- **`storage.js`** — `StorageManager`. Single source of truth for notes. All CRUD goes through `chrome.storage.local` under key `offline_notes` (settings under `offline_notes_settings`). Note shape: `{ id, title, content, tags[], createdAt, updatedAt }`. IDs are generated client-side. Both popup and sidebar instantiate their own `StorageManager` — there is no in-memory cache, so a write in one surface is visible to the other on next read.
- **`markdown.js`** — serializes a note to `.md` with a frontmatter-ish header block.
- **`write-queue.js`** — serializes mutations within a context. Public mutations on both storage classes hold it across their whole read-modify-write span.
- **`page-storage.js`** — `PageNoteStorage`, page notes keyed by canonical URL under `offline_page_notes`. Shape: `{id, url, pageTitle, highlights[], savedContent?, createdAt, updatedAt}`.
- **`page-content.js`** + **`readability.js`** — readable article extraction, injected on demand by the service worker, never declared as content scripts.
- **`text-locate.js`** — finds a stored quote inside the rebuilt article text. Both sides are normalized because the snapshot's whitespace and punctuation differ from the live DOM.
- **`vault.js`** — mirrors notes to a folder chosen via the File System Access API. Write-only, sidebar-driven, because `showDirectoryPicker` needs a document and a gesture.
- **`theme.js`** — paper/white theme switch.
- **`highlight-style.js`** — the five highlight colours and emphasis (offsets into a highlight's own text), plus the run-splitting both the live page and the reader paint with.
- **`highlight-order.js`** — the remembered listing order for highlights, shared by the sidebar and export.
- **`text-blocks.js`** — the DOM-to-text-plus-blocks walker, shared by the page extractor and the file importer.
- **`file-import.js`** — local Markdown and HTML into the same record shape a saved web page produces.
- **`cornell-export.js`** — Cornell layout over existing fields; adds no data.

**Every file in `lib/` is a classic script sharing one global scope.** Two
modules declaring the same top-level `const` makes the second fail to parse,
silently, and its global simply goes missing. Wrap module bodies in an IIFE and
export explicitly. A browser test asserts each shared module reaches the page
that loads it.
- **`backup.js`** — `BackupManager`. Owns the full backup shape across every storage key, validates a file before restoring, and summarizes what a restore would replace.
- **`templates.js`** — 5 HTML-string templates (`paper-default`, `paper-minimal`, `paper-card`, `paper-quote`, `paper-letterhead`) keyed by name. Templates use inline styles and must `escapeHtml()` user content — XSS prevention lives here, not at render time.
- **`image-generator.js`** — wraps `html2canvas` (bundled locally at `lib/html2canvas.min.js`, not a CDN) to render a template to a 2x PNG and trigger download.

### Key constraints

- **No CDN dependencies at runtime.** html2canvas is vendored into `lib/` for offline operation. Don't reintroduce CDN `<script src>` — the README's CDN mention is outdated (see v1.0.3 fix in CHANGELOG).
- **No cloud / network calls.** The extension's whole value prop is local-only. Don't add `host_permissions`, `fetch`, or telemetry.
- **Permissions are deliberately minimal** (`storage`, `sidePanel`, `tabs`). `tabs` is only used to get `windowId` for `sidePanel.open`.
- **Templates produce HTML strings that get injected into the DOM before rasterization** — every interpolation of note fields must go through `escapeHtml`. Adding a new template without escaping user content is an XSS bug even though output is an image.

## Adding a new image template

Edit `lib/templates.js`: add a method returning an HTML string (wrap all `note.*` interpolations in `this.escapeHtml(...)`), then register it in the `this.templates` map in the constructor. The sidebar's template dropdown reads from that map.
