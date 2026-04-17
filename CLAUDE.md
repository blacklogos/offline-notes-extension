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

"Tests" are manual HTML harnesses opened directly in a browser — they are not automated:
- `test-image-generation.html` — exercises `lib/image-generator.js` + `lib/templates.js` via html2canvas.
- `test-templates.html` — visual preview of the 5 image templates.
- `generate-icons.html` — one-off tool to regenerate `images/` icons.

Chrome 114+ is required (Side Panel API).

## Architecture

Three entry points, all sharing the `lib/` modules via plain `<script>` tags (no ES modules in popup/sidebar; the background is declared `"type": "module"` but currently imports nothing):

- **`popup/`** — `action.default_popup`. Quick-capture UI bound to `Alt+N`.
- **`sidebar/`** — `side_panel.default_path`. Full note manager (list, search, tag filter, editor, export). Bound to `Alt+Shift+N`.
- **`background/background.js`** — service worker. Only responsibility is routing the two `chrome.commands` shortcuts (`quick-note`, `open-sidebar`) and opening the side panel on install. It does **not** broker data between popup and sidebar — both read/write `chrome.storage.local` directly through `StorageManager`.

Shared library layer (`lib/`), each file defines a class on the global scope:

- **`storage.js`** — `StorageManager`. Single source of truth for notes. All CRUD goes through `chrome.storage.local` under key `offline_notes` (settings under `offline_notes_settings`). Note shape: `{ id, title, content, tags[], createdAt, updatedAt }`. IDs are generated client-side. Both popup and sidebar instantiate their own `StorageManager` — there is no in-memory cache, so a write in one surface is visible to the other on next read.
- **`markdown.js`** — serializes a note to `.md` with a frontmatter-ish header block.
- **`templates.js`** — 5 HTML-string templates (`default`, `minimal`, `card`, `quote`, `modern`) keyed by name. Templates use inline styles and must `escapeHtml()` user content — XSS prevention lives here, not at render time.
- **`image-generator.js`** — wraps `html2canvas` (bundled locally at `lib/html2canvas.min.js`, not a CDN) to render a template to a 2x PNG and trigger download.

### Key constraints

- **No CDN dependencies at runtime.** html2canvas is vendored into `lib/` for offline operation. Don't reintroduce CDN `<script src>` — the README's CDN mention is outdated (see v1.0.3 fix in CHANGELOG).
- **No cloud / network calls.** The extension's whole value prop is local-only. Don't add `host_permissions`, `fetch`, or telemetry.
- **Permissions are deliberately minimal** (`storage`, `sidePanel`, `tabs`). `tabs` is only used to get `windowId` for `sidePanel.open`.
- **Templates produce HTML strings that get injected into the DOM before rasterization** — every interpolation of note fields must go through `escapeHtml`. Adding a new template without escaping user content is an XSS bug even though output is an image.

## Adding a new image template

Edit `lib/templates.js`: add a method returning an HTML string (wrap all `note.*` interpolations in `this.escapeHtml(...)`), then register it in the `this.templates` map in the constructor. The sidebar's template dropdown reads from that map.
