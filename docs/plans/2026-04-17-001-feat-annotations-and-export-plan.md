---
title: "feat: Per-Highlight Annotations + Highlight Export"
type: feat
status: active
date: 2026-04-17
origin: docs/brainstorms/2026-04-17-annotations-export-pagesave-requirements.md
---

# feat: Per-Highlight Annotations + Highlight Export

## Overview

Extend the v1.1.0 highlight-capture system with two features: (1) an optional comment/note per highlight, attachable at capture time and editable later in the sidebar, and (2) export of page notes + highlights as markdown — downloadable file, clipboard copy, or batch export of all page notes. Selective export via per-highlight checkboxes lets users pick which highlights to include. Feature C (page save) from the origin doc is deferred to a separate plan.

## Problem Frame

See origin: [`docs/brainstorms/2026-04-17-annotations-export-pagesave-requirements.md`](../brainstorms/2026-04-17-annotations-export-pagesave-requirements.md). Highlights are bare text snippets with no user annotation ("I saved this" but not "because…"). Page notes are trapped inside the extension with no export path.

## Requirements Trace

- A1. Highlight schema gains optional `comment` field (empty string default)
- A2. Bubble expands post-save with optional comment textarea
- A3. Sidebar detail: editable comment area per highlight card
- A4. Comments are plain text, no rendering, no limit
- A5. "Copy as markdown quote" includes comment when present
- B1. Sidebar detail gains "Export as Markdown" (download) + "Copy all as Markdown" (clipboard)
- B1b. Per-highlight checkboxes for selective export; select-all toggle
- B2. "Export all page notes" in sidebar header produces a single merged markdown file
- B3. Markdown format: h1 title, source URL, highlights as blockquotes + comments
- B4. Exported markdown includes `savedContent` section when present (future-proofing for feature C)

## Scope Boundaries

- Plain text comments only — no markdown rendering inside comments, no rich text
- No JSON export (deferred)
- No import (deferred)
- Feature C (page save / bookmark hybrid) is a separate plan
- No batch comment operations

### Deferred to Separate Tasks

- **Feature C: Save webpage (hybrid bookmark + readable content)** — separate plan with new permissions + readability library
- **JSON backup/restore** — future iteration
- **PDF export** — future iteration

## Context & Research

### Relevant Code and Patterns

- **`lib/page-storage.js`** — `PageNoteStorage` class. Highlight shape: `{id, text, anchor:{exact,prefix,suffix}, capturedAt}`. Needs a `comment` field and an `updateHighlightComment(pageNoteId, highlightId, comment)` method.
- **`background/background.js`** — SAVE_HIGHLIGHT handler creates the highlight object (`{id: crypto.randomUUID(), text, anchor, capturedAt}`). Needs to accept + store `comment`. Needs a new `UPDATE_HIGHLIGHT_COMMENT` message handler.
- **`content/highlight.js`** — bubble in Shadow DOM. `captureCurrentSelection()` sends SAVE_HIGHLIGHT. Post-save, bubble shows "Saved" for 1.2s then hides. Needs to expand with a textarea instead of immediately hiding.
- **`sidebar/sidebar.js`** — `renderHighlights(note)` builds per-highlight cards. `copyHighlightAsQuote(h, note)` produces the markdown quote. Both need comment integration.
- **`lib/markdown.js`** — `MarkdownExporter` class for manual notes. Pattern to follow for page-note export (separate new file `lib/page-note-export.js` to keep concerns separate).

## Key Technical Decisions

- **New file `lib/page-note-export.js`** instead of extending `lib/markdown.js`. Rationale: the two exporters serve different entity types (manual notes vs page notes) with different formats. Keeping them separate avoids coupling and makes each file easy to reason about independently.
- **Checkbox selection state is transient** — not persisted to storage. Checkboxes live in the sidebar detail modal; opening the modal starts with none checked (= export all). Rationale: persisting per-highlight checked state would add storage writes on every checkbox toggle for no durable user value.
- **"Export all" produces a single merged `.md` file** (not a zip). Rationale: avoids vendoring a zip library. Page notes are separated by `---` with page title as `##` heading. Single file is also easier to paste into a doc or open in a text editor.
- **Bubble comment textarea auto-saves on Enter or blur.** No explicit "Save comment" button — the bubble is a transient surface and adding a second button would make it feel heavy. Pressing Enter saves and dismisses; clicking away saves silently.
- **`comment` field defaults to empty string, not null/undefined.** Rationale: simplifies downstream checks (`h.comment ? ... : ...` → `h.comment !== ''`). Existing highlights without the field are treated as `''` by checking `h.comment || ''` in the export and rendering paths.

## Open Questions

### Resolved During Planning

- *Bubble expansion size*: textarea is 80px tall max, grows downward from the pill. If the pill is near the viewport bottom, the textarea appears above the pill instead (CSS `bottom` anchor flip).
- *"Export all" packaging*: single merged `.md` file with `---` section separators and `## Page Title` headings per page note.
- *Checkbox default*: none checked = all included. Checking any checkbox switches to selective mode.
- *B4 (savedContent in export)*: the export function includes a `## Saved Content` section when `pageNote.savedContent` is truthy. This field doesn't exist yet (feature C), but the conditional costs nothing and means export won't need updating when C ships.

### Deferred to Implementation

- *Bubble textarea repositioning edge case*: exact flip logic (check bounding rect of the bubble host against `window.innerHeight`). Tune by manual testing.
- *"Select all" toggle label*: "Select all" when none/some are checked; "Deselect all" when all are checked. Exact toggle logic is straightforward but easier to get right in code than to spec in prose.
- *Markdown escaping*: highlight text and comments may contain characters that look like markdown syntax (e.g. `>`, `#`, `*`). The export function should NOT escape these — the text is user content inside blockquotes and paragraphs, and markdown renderers handle it correctly. Verify during implementation.

## Implementation Units

- [ ] **Unit 1: Schema + storage — add `comment` field and update methods**

**Goal:** Extend the Highlight schema with `comment`, add `updateHighlightComment` to `PageNoteStorage`, update the SAVE_HIGHLIGHT handler in the service worker to accept an optional comment.

**Requirements:** A1

**Dependencies:** None (v1.1.0 must be merged — assumed).

**Files:**
- Modify: `lib/page-storage.js`
- Modify: `background/background.js`

**Approach:**
- `PageNoteStorage` gains `updateHighlightComment(pageNoteId, highlightId, comment)` — finds the highlight by id within the page note and sets `.comment = comment`. Updates `updatedAt` on the page note.
- SAVE_HIGHLIGHT handler in `background/background.js`: the highlight object creation (`{id, text, anchor, capturedAt}`) gains `comment: p.comment || ''`.
- New message type `UPDATE_HIGHLIGHT_COMMENT`: accepts `{pageNoteId, highlightId, comment}`, calls `pageStorage.updateHighlightComment(...)`, responds `{ok: true}`.

**Patterns to follow:**
- `PageNoteStorage.deleteHighlight` for the find-by-id-within-page-note pattern.
- Existing message handler structure in `background/background.js`.

**Test scenarios:**
- *Happy path*: `appendHighlight` with `comment: "important"` → `getByUrl` returns the highlight with `comment === "important"`.
- *Happy path*: `updateHighlightComment` on an existing highlight → comment changes, page note `updatedAt` advances.
- *Edge case*: `appendHighlight` without `comment` field → highlight stored with `comment` defaulting to `''`.
- *Edge case*: `updateHighlightComment` with empty string → clears the comment (not an error).
- *Error path*: `updateHighlightComment` with non-existent `highlightId` → returns `false`, no crash.
- *Integration*: content script sends SAVE_HIGHLIGHT with `{..., comment: "test"}` → background creates highlight with comment → GET_PAGE_NOTE returns it with the comment intact.

**Verification:**
- Storage round-trip: save highlight with comment → retrieve → comment matches.
- UPDATE_HIGHLIGHT_COMMENT message handler responds correctly.

---

- [ ] **Unit 2: Bubble annotation — expand post-save with comment textarea**

**Goal:** After a highlight is saved (bubble shows "Saved"), the bubble expands to reveal a small textarea for an optional comment. Typing and pressing Enter (or blurring) saves the comment via UPDATE_HIGHLIGHT_COMMENT. Dismissing without typing leaves the comment empty.

**Requirements:** A2

**Dependencies:** Unit 1.

**Files:**
- Modify: `content/highlight.js`

**Approach:**
- After `flashBubbleResult('saved')` receives `response.highlight`, instead of setting a hide timer, expand the bubble by inserting a textarea row below the pill inside the Shadow DOM.
- The textarea is styled with warm-paper tokens (inline, since Shadow DOM), 80px max-height, placeholder "Add a note (optional)…".
- On Enter (not Shift+Enter) or blur: if text is non-empty, send `chrome.runtime.sendMessage({type: 'UPDATE_HIGHLIGHT_COMMENT', pageNoteId: response.pageNote.id, highlightId: response.highlight.id, comment: textarea.value})`. Then hide the bubble.
- On Escape: hide bubble without saving a comment.
- Viewport-edge handling: if the bubble's bottom edge + 100px exceeds `window.innerHeight`, flip the textarea above the pill via CSS.
- The bubble host element gains a `.expanded` class that widens it slightly (from the small pill to ~240px) to accommodate the textarea.

**Patterns to follow:**
- Existing bubble Shadow DOM markup and styling in `content/highlight.js`.
- `captureCurrentSelection` already receives `response.highlight` and `response.pageNote` from the SAVE_HIGHLIGHT response.

**Test scenarios:**
- *Happy path*: save a highlight → bubble shows "Saved" briefly → textarea appears → type "important" → press Enter → UPDATE_HIGHLIGHT_COMMENT fires → bubble hides.
- *Happy path*: save a highlight → textarea appears → click away (blur) with text → comment saves silently.
- *Edge case*: save a highlight → textarea appears → press Escape → bubble hides, no comment saved (comment remains `''`).
- *Edge case*: save a highlight → textarea appears → click away with empty textarea → no message sent, comment stays `''`.
- *Edge case*: selection is near the bottom of the viewport → textarea renders above the pill instead of below.
- *Integration*: save highlight, type comment in bubble, open sidebar Pages tab → the highlight card shows the comment.

**Verification:**
- Manual smoke: save a highlight on a real page, type a comment in the expanded bubble, check the sidebar detail for the comment.

---

- [ ] **Unit 3: Sidebar annotation + selection UI**

**Goal:** Each highlight card in the Pages detail modal shows the comment (editable), a checkbox for selective export, and a select-all toggle. The editable comment area auto-saves on blur via UPDATE_HIGHLIGHT_COMMENT.

**Requirements:** A3, A4, A5, B1b

**Dependencies:** Unit 1.

**Files:**
- Modify: `sidebar/sidebar.js`
- Modify: `sidebar/sidebar.css`
- Modify: `sidebar/sidebar.html` (add select-all toggle + export buttons in the page modal)

**Approach:**
- `renderHighlights(note)`: each highlight card gains:
  - A checkbox (`<input type="checkbox" class="hl-checkbox">`) at the left edge of the card, before the highlight text. Unchecked by default.
  - Below the highlighted text: a `<div class="highlight-comment">` containing either the comment text (if non-empty) or a muted placeholder "Add a note…" (clickable → becomes a textarea).
  - Clicking the placeholder or existing comment swaps it for a `<textarea>` (auto-focus, same warm-paper styling). On blur: if changed, send UPDATE_HIGHLIGHT_COMMENT message, re-render the card.
- Above the highlights list in the page modal: a toolbar row with:
  - `<label><input type="checkbox" id="selectAllHighlights"> Select all</label>` — toggles all highlight checkboxes. Label text flips to "Deselect all" when all are checked.
  - The export buttons (from Unit 5) will sit in this row.
- `copyHighlightAsQuote(h, note)` updated per A5: if `h.comment`, the output becomes `> {text}\n>\n> *{comment}*\n>\n> — [{pageTitle}]({url})`.
- CSS additions: `.hl-checkbox` styling (small, sage-500 accent-color), `.highlight-comment` (muted text, editable state), `.highlight-toolbar` (row above highlights list).

**Patterns to follow:**
- Existing `renderHighlights` card structure in `sidebar/sidebar.js`.
- Inline-edit pattern: swap div → textarea on click, save on blur. No existing pattern in codebase; this is new but simple.

**Test scenarios:**
- *Happy path*: open a page note with 3 highlights, none have comments → all show "Add a note…" placeholder. Click one → textarea appears → type "my note" → click away → comment saves → re-renders with "my note" visible.
- *Happy path*: open a page note where one highlight already has a comment → comment text shown. Click it → editable textarea → change text → blur → update saves.
- *Happy path*: check 2 of 3 checkboxes → "Select all" label stays "Select all". Check the 3rd → label flips to "Deselect all". Uncheck one → flips back to "Select all".
- *Edge case*: edit a comment to empty string → clears the comment, placeholder returns.
- *Edge case*: blur fires on the textarea but text is identical to original → no message sent (skip unnecessary write).
- *Edge case*: delete a highlight while its comment textarea is open → no crash (card is removed from DOM, blur fires on a detached element).
- *Integration*: "copy as markdown quote" on a highlight with comment "important" → clipboard contains `> text\n>\n> *important*\n>\n> — [Title](url)`.

**Verification:**
- Comments create/edit/clear cycle works in the sidebar. Checkboxes toggle correctly. Copy-as-quote includes comments.

---

- [ ] **Unit 4: Page-note markdown export module**

**Goal:** Create `lib/page-note-export.js` with functions to serialize a page note (or a subset of its highlights) to markdown. Handles single-page and batch (all page notes) export.

**Requirements:** B1, B1b, B2, B3, B4

**Dependencies:** None (pure function module, no UI).

**Files:**
- Create: `lib/page-note-export.js`

**Approach:**
- `PageNoteExporter` class (global, same pattern as `MarkdownExporter`).
- `exportPageNote(pageNote, selectedHighlightIds?)` → markdown string. If `selectedHighlightIds` is provided (array of ids), only those highlights are included; otherwise all. Format per B3:
  ```
  # Page Title
  Source: [url](url)
  Saved: date | N highlights

  > Highlighted text
  >
  > *User comment*

  > Another highlight

  ---
  ```
  If `pageNote.savedContent` is truthy (future feature C), append a `## Saved Content` section with the content.
- `exportAllPageNotes(pageNotes)` → merged markdown string. Each page note separated by `\n---\n\n`, using `##` headings (since the merged doc has no single h1 — or use the first page as h1 and rest as h2; simpler: every page note uses `##` and the file starts with `# Offline Notes Export`).
- `downloadMarkdown(text, filename)` — creates a Blob, triggers download via `URL.createObjectURL` + click-to-download pattern (same as `image-generator.js`).
- `copyToClipboard(text)` — `navigator.clipboard.writeText(text)`.
- All user-content interpolation uses the text as-is (no HTML escaping needed in markdown context; no markdown escaping per Deferred to Implementation note).

**Patterns to follow:**
- `lib/markdown.js` `MarkdownExporter` class structure.
- `lib/image-generator.js` download pattern (Blob → createObjectURL → click → revoke).

**Test scenarios:**
- *Happy path*: `exportPageNote` with 3 highlights (1 with comment, 2 without) → markdown contains 3 blockquotes, the commented one has `*comment*` paragraph, the others don't.
- *Happy path*: `exportPageNote` with `selectedHighlightIds` containing 2 of 3 ids → only 2 blockquotes in output.
- *Happy path*: `exportAllPageNotes` with 3 page notes → output starts with `# Offline Notes Export`, contains 3 `##` sections separated by `---`.
- *Edge case*: page note with 0 highlights → output contains title + source URL + "No highlights" note.
- *Edge case*: `selectedHighlightIds` is empty array → output contains title + URL + "No highlights selected".
- *Edge case*: highlight text contains markdown-like characters (`> foo`, `# bar`, `**bold**`) → included verbatim inside blockquote, renders correctly in markdown viewers.
- *Edge case*: comment contains newlines → each line is prefixed with `> ` to stay inside the blockquote.
- *Happy path*: `downloadMarkdown` triggers a download with the correct filename and content.
- *Happy path*: `copyToClipboard` writes the text to clipboard (navigator.clipboard.writeText).

**Verification:**
- The exported markdown, when opened in a markdown viewer, renders as readable highlighted quotes with source attribution.

---

- [ ] **Unit 5: Sidebar export wiring — download, clipboard, export-all buttons**

**Goal:** Wire the export module into the sidebar UI. Page-note detail modal gets "Export Markdown" (download) and "Copy all" (clipboard) buttons that respect checkbox selection. Sidebar header gets "Export all page notes" option alongside the existing "Export all notes" button.

**Requirements:** B1, B1b, B2

**Dependencies:** Units 3, 4.

**Files:**
- Modify: `sidebar/sidebar.html`
- Modify: `sidebar/sidebar.js`
- Modify: `sidebar/sidebar.css`

**Approach:**
- Page modal (`#pageModal`): the toolbar row added in Unit 3 gains two buttons:
  - "Export MD" — calls `PageNoteExporter.exportPageNote(currentPageNote, getSelectedHighlightIds())` → `downloadMarkdown(result, filename)`.
  - "Copy all" — calls the same export function → `copyToClipboard(result)` → flash "Copied" in the metadata area.
  - `getSelectedHighlightIds()`: reads all `.hl-checkbox:checked` in the modal. Returns `null` if none are checked (= export all) or an array of ids if any are checked.
- Sidebar header: the existing `#exportAllMd` button currently exports all manual notes. Two options: (a) repurpose it as a dropdown with "Export all notes" + "Export all page notes", or (b) add a second button. Simplest: on the Pages tab, the export-all button runs `PageNoteExporter.exportAllPageNotes(allPageNotes)` → download. On the Notes tab, it runs the existing manual-notes export. The button label and handler swap when the tab switches.
- Load `lib/page-note-export.js` via a `<script>` tag in `sidebar/sidebar.html` (same pattern as other lib files).

**Patterns to follow:**
- Existing export button handler for manual notes in `sidebar/sidebar.js` (the `exportAllMd` click handler).
- `flashPageMetadata` helper for transient status messages.

**Test scenarios:**
- *Happy path*: open a page note with 5 highlights → no checkboxes checked → click "Export MD" → downloads `.md` with all 5 highlights.
- *Happy path*: check 2 of 5 highlights → click "Export MD" → downloaded `.md` contains only 2 blockquotes.
- *Happy path*: click "Copy all" → clipboard contains the same markdown as the download would produce → "Copied" flash.
- *Happy path*: switch to Pages tab → click the header export button → downloads a merged `.md` with all page notes.
- *Happy path*: switch to Notes tab → click the same header export button → exports manual notes (existing behavior unchanged).
- *Edge case*: export a page note with 0 highlights → `.md` downloads with title + URL + "No highlights".
- *Edge case*: `navigator.clipboard.writeText` throws (permissions denied) → "Copy failed" flash.
- *Integration*: save a highlight with a comment via the bubble → open sidebar → export → markdown includes the comment in `*italics*` below the blockquote.

**Verification:**
- Full round-trip: highlight text on a page → add comment → export from sidebar → open `.md` in a markdown viewer → highlights + comments + source URL render correctly.
- Export-all produces a readable merged document when multiple page notes exist.

## System-Wide Impact

- **Interaction graph:** `content/highlight.js` gains a new outbound message type (UPDATE_HIGHLIGHT_COMMENT) to the service worker. The service worker gains one new handler. The sidebar gains new UI elements (checkboxes, comment areas, export buttons) inside the existing page-modal surface. A new lib file (`lib/page-note-export.js`) is loaded by the sidebar only.
- **Error propagation:** Comment save failures (UPDATE_HIGHLIGHT_COMMENT) are swallowed silently (consistent with the existing console.error posture). Export failures (download or clipboard) surface a transient flash in the sidebar metadata area.
- **State lifecycle risks:** Transient checkbox state can desync if the page note is modified externally (e.g. a new highlight is captured while the modal is open). Mitigation: the storage `onChanged` listener already calls `loadPageNotes()`; re-rendering the modal content on change would reset checkboxes. Acceptable for v1 — the user re-checks if needed.
- **API surface parity:** `copyHighlightAsQuote` (existing single-highlight copy) and the new export module both produce markdown with the same quote format. Keep them in sync — use a shared formatting helper if the duplication grows beyond two call sites.
- **Unchanged invariants:** Manual notes (StorageManager, MarkdownExporter), popup, image generation, toolbar icon, badge, re-paint — all unchanged. Page-note storage shape is backward-compatible (new `comment` field defaults to empty string; old highlights without it are read as `''`).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Bubble expansion feels heavy or interferes with the page's layout. | Expansion is inside Shadow DOM — no layout impact on the host page. Max height capped at 80px. Escape key dismisses instantly. |
| Checkbox state resets when the modal re-renders (external storage change). | Acceptable for v1 — happens rarely (capture in another tab while modal is open). Document as known limitation. |
| Large page notes (50+ highlights) make the export markdown very long. | No truncation — the user chose to export. Markdown files can be arbitrarily large. |
| `navigator.clipboard.writeText` blocked in some extension contexts. | Catch and show "Copy failed" flash. The download path always works as a fallback. |

## Documentation / Operational Notes

- CHANGELOG entry: "Added: per-highlight comments (type at capture time or edit in sidebar). Added: highlight export as markdown (per-page download + clipboard copy, selective via checkboxes, batch export all page notes)."
- README: update the highlight-capture features section to mention comments and export.

## Sources & References

- **Origin document:** [`docs/brainstorms/2026-04-17-annotations-export-pagesave-requirements.md`](../brainstorms/2026-04-17-annotations-export-pagesave-requirements.md)
- Related code: `lib/page-storage.js`, `content/highlight.js`, `sidebar/sidebar.js`, `background/background.js`, `lib/markdown.js` (pattern reference)
