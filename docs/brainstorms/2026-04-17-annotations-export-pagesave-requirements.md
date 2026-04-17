---
date: 2026-04-17
topic: annotations-export-pagesave
---

# Per-Highlight Annotations, Highlight Export, and Page Save

Three independent features that extend the v1.1.0 highlight-capture infrastructure. They share the existing page-note data model but have no cross-dependencies — each can ship independently in any order.

## Problem Frame

**Annotations.** Users can save highlights from any page, but cannot annotate *why* they saved a passage. The highlight is a bare snippet — useful for recall, useless for synthesis. Adding a per-highlight comment turns "I saved this" into "I saved this because…"

**Export.** Page notes and their highlights are currently trapped inside the extension. Users who research across multiple articles and annotate their highlights have no way to get a deliverable out — a markdown doc, a clipboard block for pasting into a doc, or a structured backup. The manual-notes system has markdown export (`lib/markdown.js`); page notes do not.

**Page save.** Users browsing the web sometimes want to save an entire page — not just a highlight — for offline reading or as a reference. The extension currently captures only selected text. Saving a page's readable content locally (plus bookmarking the URL for Chrome-native discoverability) extends the extension into a lightweight read-later tool without adding cloud dependencies.

## Requirements

### A · Per-Highlight Annotations

- A1. Each highlight gains an optional `comment` field (string, empty by default). Existing highlights with no comment continue to work unchanged.
- A2. After saving a highlight (bubble click, context menu, or shortcut), the bubble expands to reveal a small textarea labeled "Add a note (optional)." The user can type and press Enter (or click away) to attach the comment. Dismissing without typing is fine — the highlight saves with an empty comment.
- A3. In the sidebar Pages detail view, each highlight card displays the comment (if any) below the highlighted text. Clicking the comment area makes it editable (inline, auto-saves on blur). If no comment exists, a muted "Add a note…" placeholder is shown; clicking it creates the comment.
- A4. Comments are plain text. No markdown rendering, no rich text, no character limit beyond the practical storage ceiling.
- A5. The "copy as markdown quote" action (existing) includes the comment in the output when present: `> highlighted text\n>\n> *user comment*\n>\n> — [Page Title](url)`.

### B · Highlight Export

- B1. The sidebar Pages detail view gains two new export actions:
  - **Export as Markdown** — downloads a `.md` file. Structure: page title as `# heading`, source URL below, then each highlight as a blockquote with its comment (if any) as a paragraph below it, ordered by `capturedAt`. File name derived from page title.
  - **Copy all as Markdown** — writes the same markdown to the clipboard. Single button, no file-save dialog.
- B1b. Each highlight card in the Pages detail view gains a checkbox. When one or more highlights are checked, the export actions operate only on the selected set. When no checkboxes are checked, all highlights are included (current behavior). A "Select all / Deselect all" toggle appears once any checkbox is checked.
- B2. The "Export all" button in the sidebar header (currently for manual notes only) gains an option or expands to include "Export all page notes" — produces a zip file or a single merged markdown document with one section per page note, sorted by `updatedAt`.
- B3. The markdown format for a single page note:
  ```
  # Page Title
  Source: [url](url)
  Saved: date | N highlights

  > Highlighted text one
  > 
  > *My comment on this highlight*

  > Highlighted text two

  ---
  ```
- B4. If the page note has `savedContent` (from feature C below), the export includes the readable content below the highlights section, under a `## Saved Content` heading.

### C · Save Webpage (Hybrid: Bookmark + Readable Content)

- C1. The user can save a page via two triggers:
  - **Right-click context menu** (on page background, not on selected text): "Save page to Offline Notes."
  - **Keyboard shortcut**: new entry in `manifest.json` commands (suggested `Alt+S`).
- C2. Saving a page does two things in parallel:
  - Extracts the readable content (article text + inline images) using a readability algorithm and stores it in the page note's new `savedContent` field.
  - Creates a Chrome bookmark in a managed folder called "Offline Notes" (under "Other Bookmarks" or the bookmarks bar — per Chrome default for programmatic bookmark creation). Requires adding the `bookmarks` permission to `manifest.json`.
- C3. If a page note for that URL already exists (from prior highlights), the save enriches it with `savedContent`. If no page note exists, one is created with an empty `highlights` array and the `savedContent` populated.
- C4. The Pages tab in the sidebar shows a visual indicator on page notes that have saved content (e.g. a small "saved" badge or a distinct icon). Clicking into the page note reveals a "Read" view alongside the highlights list.
- C5. The "Read" view renders the `savedContent` as clean, styled HTML inside the sidebar — respecting the warm-paper tokens (cream background, Inter Display, ink-900 text). Images are shown inline. No external stylesheets are loaded; the content is self-contained.
- C6. If the page goes offline or the URL becomes unreachable, the saved content is still readable from the sidebar. This is the core value of saving: offline access to the readable content.
- C7. The bookmark is a convenience for Chrome-native discoverability (address bar suggestions, bookmark manager). If the user deletes the bookmark manually, the saved content in the extension is unaffected. If the user deletes the page note from the extension, the bookmark is also deleted (cleanup).
- C8. Saving a page that is already saved (same canonical URL) replaces the `savedContent` with a fresh extraction. The `savedAt` timestamp is updated. Highlights and comments are preserved.
- C9. There is no automatic save-on-highlight. Saving a page is always an explicit user action.

## Success Criteria

- A user can highlight a passage, type a short comment in the bubble, see that comment in the sidebar, edit it, and have it included in the markdown export.
- A user can open a page note with 10 highlights, click "Export as Markdown," and receive a well-formatted `.md` file with all highlights, comments, and source URL.
- A user can right-click on an article, choose "Save page to Offline Notes," go offline, and read the article's content from the sidebar with all formatting intact.
- Existing workflows (manual notes, highlight capture without comments, image export) are unchanged.

## Scope Boundaries

- **No rich-text comments.** Comments are plain text. Markdown rendering inside comments is a future iteration.
- **No full-page snapshot.** Saved content is the readable/article portion, not a pixel-perfect visual clone. Interactive pages, SPAs, and heavily-dynamic content may extract poorly — accepted as a known limitation of readability algorithms.
- **No cloud sync of saved content.** Everything stays in `chrome.storage.local`, consistent with the extension's offline-only posture.
- **No tag/folder organization for page notes.** Page notes remain a flat list sorted by recency. Tagging and folders are a separate brainstorm.
- **No batch operations** beyond "Export all page notes." No batch-save, no batch-delete, no batch-comment.
- **No automatic periodic re-save** of page content. Saving is always user-initiated (C9).

### Deferred to Separate Tasks

- **PDF export of page notes / highlights.** Markdown covers the immediate need; PDF is a separate brainstorm.
- **Import page notes from JSON backup.** Export-without-import is acceptable for v1; import is a durability feature for v2.
- **Reading list / queue UI** for saved pages (a "read next" flow distinct from the flat Pages list). Separate brainstorm if demand surfaces.

## Key Decisions

- **Annotations attach to individual highlights, not to page notes.** Rationale: the unit of thought is "why I saved this passage," not "what I think about this page." A page-level note would duplicate the manual-notes system.
- **Both at-capture and after-the-fact annotation.** Rationale: some users know immediately why they're saving; others annotate during a review pass later. Supporting both is low incremental cost (the sidebar already has per-highlight cards; the bubble already has a post-save success state to expand).
- **Markdown file + clipboard copy for export** (not JSON-only or PDF). Rationale: markdown is human-readable, portable, and matches the existing manual-notes export format. Clipboard copy covers the "paste into a Google Doc" use case without a file-save dialog. JSON backup is deferred.
- **Page save enriches the existing page note, not a separate entity.** Rationale: one entity per URL keeps the data model simple. The Pages tab already lists page notes by URL; adding saved content to the same entity means the user sees highlights and saved content together.
- **Hybrid bookmark + readable content.** Rationale: the bookmark makes saved pages findable via Chrome's address bar and bookmark manager (native UX the user already knows). The readable content makes pages accessible offline. Neither alone covers both needs.
- **Readability extraction, not full-page snapshot.** Rationale: full-page snapshots are 1–10 MB each, exhaust `chrome.storage.local` quickly, and require vendoring a complex library (SingleFile is ~200 KB+). Readable extraction is ~50–200 KB per page, covers the 80% case (articles, blog posts, documentation), and can use a lightweight library (Readability.js is ~40 KB, MIT licensed, vendorable).

## Dependencies / Assumptions

- v1.1.0 (highlight capture + warm-paper UX) is merged. The requirements above extend `PageNoteStorage`, the sidebar Pages tab, and the content script — all of which must exist first.
- Readability algorithm: the plan should evaluate vendoring Mozilla's Readability.js (~40 KB, MIT licensed, used by Firefox Reader View) vs. a lighter custom extraction. Readability.js is the safe choice; custom extraction is smaller but less reliable.
- `bookmarks` permission is new. It does not trigger a "Read and change all your data" warning — the warning is narrower ("Read and change your bookmarks"). Acceptable.
- `chrome.storage.local` ceiling: with readable content (~50–200 KB per page) added to the existing page-note storage, heavy users (50+ saved pages) may approach the ~10 MB default. `chrome.storage.local.QUOTA_BYTES` is ~5.2 MB unless `unlimitedStorage` permission is added. The plan should decide whether to add `unlimitedStorage` or to surface a storage-usage indicator + cap saved pages.

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions are settled)

### Deferred to Planning

- [Affects C2][Needs research] Readability library choice: vendor Readability.js vs. custom extraction. Evaluate size, reliability on common article formats, and licensing.
- [Affects C2][Technical] Image handling in saved content: inline images as data URIs (increases storage per page significantly) or store image URLs and accept that they break offline? Trade-off between offline fidelity and storage footprint.
- [Affects C5][Technical] Rendering saved content in the sidebar: sanitize the HTML (strip scripts, event handlers, external stylesheets) before injecting into the sidebar. Use a sandboxed iframe or DOMPurify-style sanitization.
- [Affects C7][Technical] Bookmark folder management: create a top-level "Offline Notes" folder on first use; handle the case where the user deletes the folder manually (re-create on next save? log a warning?).
- [Affects B2][Technical] "Export all page notes" packaging: single merged `.md` file vs. zip of per-page `.md` files. Zip requires a vendored zip library or the Compression Streams API.
- [Affects all][Technical] Storage ceiling: decide whether to add `unlimitedStorage` permission (no user-visible prompt, just a manifest declaration) or implement a soft cap with a usage indicator in the sidebar.
- [Affects A2][Technical] Bubble expansion UX: how much the bubble grows (height) and whether it repositions when expanding near the bottom of the viewport.

## Next Steps

-> `/compound-engineering:ce-plan` to produce the implementation plan. Features A and B can be planned as one cohesive unit (they're small and tightly coupled — comments feed into the export format). Feature C should be planned as a separate phase since it introduces new permissions and a new library dependency.
