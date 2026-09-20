# Changelog

All notable changes to this project will be documented in this file.

## [1.3.1] - 2026-09-21

A review pass found twenty-one defects. All of them are fixed or shown not to
be defects. Most were silent: nothing failed visibly, data simply went missing
or was stored wrong.

### Privacy

The capture bubble used an open shadow root, so any site you annotated could
read your private comment about it, including one prefilled for editing, and
hiding the bubble left the text in place. The root is closed and the box is
cleared. HTML import was checked for remote requests during parsing: there are
none, now asserted by a test.

### Data loss

- Renaming a page bypassed the write queue and could erase a capture made at
  the same moment, possibly on a different page.
- Restore wrote collections directly, so an in-flight save could overwrite what
  you had just restored.
- A legacy backup omitting a collection erased it, so restoring an old
  notes-only file deleted every page note.
- A backup containing an invalid record passed validation and was written over
  real notes.
- A failed read of the notes collection became an empty one, and the next save
  wrote it back, erasing everything.
- Two files whose names differ only in punctuation shared one imported page
  note, so the second import replaced the first document while keeping its
  highlights.
- A failed note save still closed the editor and discarded the edits.
- A background change reset an unsaved summary or title.

### Highlights and the reader

- The reader hid any text not covered by a recorded block, and measured
  selections against what it displayed while storing them as positions in the
  full text, so a quote could be saved as words you never selected.
- Emphasis made in the reader was stored at displayed positions rather than
  positions in the quote, bolding the wrong characters.
- A highlight overlapping an earlier one lost its tail and its rail entry
  pointed at nothing.
- A highlight made across paragraphs in the reader could never reappear on the
  page it came from.
- Emphasis on a repeated word inside a cross-paragraph quote vanished.
- Quote lookup gave up after fifty occurrences, discarding the one your stored
  context identified.
- Two equally plausible anchor positions painted the first, putting a highlight
  on words you never highlighted; it now reports the quote as not located.
- Highlights did not reappear on pages that render by replacing text rather
  than adding it, and a busy page could prevent any retry at all.
- Single-page apps changed route without the highlights following.

### Other

Exporting all pages dropped every summary. Markdown import mangled literal
text, turning `__init__` into `init`.

### Tests

83 logic tests and 22 browser tests, up from 74 and 20.

## [1.3.0] - 2026-09-20

### Colours, and the part of a quote that matters

Five highlight colours, picked from the capture bubble or in the reader,
remembered between captures so a run in one colour is one click each. Named by
hue rather than by purpose, so the meaning is yours.

Select text inside a highlight you already made and the bubble offers **Bold**
instead of Save: mark the part of the quote that mattered most. It renders bold
on the page and in the reader, and exports as `**bold**`. Offsets are stored
against the quote's own text, so emphasis survives the page changing underneath.

That swap also fixes a bug: selecting inside a highlight and pressing Save used
to store a second overlapping copy that could never be painted.

### Read and highlight your own files

Import a Markdown or HTML file from the Pages tab and it becomes an ordinary
page note: readable, highlightable, exportable, mirrored to your folder. A
Markdown file renders better here than in a browser tab, where it is one
undifferentiated block of preformatted text. Re-importing an edited file
updates the same note and keeps its highlights.

PDF is refused with a reason rather than ignored: Chrome renders PDFs without
accessible text, so a highlight could not be anchored back to the document.

### Summary, order, and a Cornell sheet

Each page note gets a summary in your own words, shown above the article in the
reader and carried into export. Highlight lists follow one remembered order,
newest or oldest first, applied to both the sidebar and export; the reader rail
keeps article order, because it is a map of the text beside it. Before this the
same page note read back in three different sequences depending on where you
looked.

Cornell export writes a cue-and-notes table with the summary underneath. It
adds no fields: the comment already on a highlight is the cue, the quote is the
note.

### Fixes

- A selection dragged across paragraphs produced a highlight that could never
  be found again, because `range.toString()` joins block elements with no
  separator while the saved article has a blank line between them.
- Emphasis painting mixed two coordinate systems and silently dropped a
  character at the mark boundary.
- Section `[edit]` links leaked into saved Wikipedia articles.
- Two shared modules failed to load with no error at all, because classic
  scripts share one global scope and a duplicate top-level `const` makes the
  second script fail to parse. A test now asserts every shared module reaches
  the page that loads it.

### Tests

71 logic tests and 19 browser tests, no dependencies.

## [1.2.0] - 2026-09-20

### Read what you saved, offline

A saved page can now be opened in a dedicated reader: one column, adjustable
size, serif or sans, light or dark, and your reading position remembered. Your
highlights are painted in the text with a rail listing them in order; clicking
either side focuses the other. Quotes that no longer match appear under "Not
located in this saved article" rather than disappearing.

Selecting text inside the reader saves to the **source page**, not the
extension, so a highlight made while reading offline reappears on the real
article when you next visit it.

Reach it from the toolbar popup, which now shows the current page: **Read
offline** when an article is saved, **Save & read** when it is not.

### Save the article, not just the quote

Right-click a page or press `Alt+S` to store its readable text on that URL's
page note, so a highlight outlives the page it came from. Stored as plain text
on purpose: rendering saved markup would fetch remote images and embeds, and
opening a saved page must not touch the network. Headings, lists and quotes are
preserved as structure. Requires the new `unlimitedStorage` permission, since
article text passes the default 10MB cap within a few dozen pages.

### A folder of Markdown on your disk

Point the extension at a folder and every note and page note is mirrored there
as Markdown, readable by Obsidian, Spotlight, grep and git. Write-only, flat,
no deletes, no read-back, no sync engine. Nothing is transmitted; if the folder
you choose is managed by a sync service, that service may sync it.

### Highlights that actually show up

Repaint ran once at `document_idle`, so on any site that renders its article
later, which is most modern article pages, saved highlights silently never
appeared while the badge still claimed they existed. Unresolved highlights are
now retried as the page changes, and SPA navigation triggers a repaint.

A page you have highlighted before shows a small corner indicator, honest about
what it can display: "4 highlights · 3 on this page".

### Data loss, fixed

- **Concurrent saves destroyed each other.** Every mutation rewrote a whole
  collection after reading it, so simultaneous writers overwrote one another:
  eight simultaneous appends left two highlights. Writes are now serialized,
  and the service worker is the single writing context for both collections.
- **Backups contained no highlights.** `exportAllData()` omitted every page
  note, so a backup a user trusted held only manual notes.
- **Comments typed in the capture bubble were discarded**, every time.
- **The note editor threw away edits** when closed with X, the backdrop or Escape.
- **A failed save ate the popup draft**, and Clear left it behind to resurrect.
- **Save then annotate created two highlights** for one selection.
- **A background change rebuilt the page detail** over an open comment editor.

### Interface

The sidebar went from five stacked bands of chrome to two, roughly four visible
notes to nine, with markdown stripped from previews. The popup starts on the
note body instead of an optional title field, and a blank title is taken from
the first line rather than saved as "Untitled". The capture bubble is one
surface that measures itself and stays on screen. An opt-in White theme sits
beside the warm-paper default.

Exports now say what they will do: selecting three quotes copies three quotes,
not three quotes plus the whole article. The 280-character cap on comments is
gone, `Ctrl/Cmd+K` no longer erases a draft with no undo, and deleting a page
note names the saved article it destroys.

### Typography

Vietnamese was rendering incorrectly: Charter and Iowan Old Style report full
coverage to every programmatic check yet render "dựa" as "dủa", because macOS
substitutes the horn-plus-tone composites from another face. Georgia renders
the set correctly and now leads the serif stack. The sans option uses the
bundled Inter Display, identical on every machine.

### Backup you can actually reach

Export and restore now live in the sidebar footer. A backup carries every key
the extension owns, including the theme and reader preferences that earlier
"full" exports dropped. Restoring validates the file, then states what it holds
and what it will replace before touching anything. It replaces rather than
merges, and a file missing a key leaves that key alone.

### Tests

`node test/run.js` covers quote location, article extraction, write
serialization and backup validation. `node test/browser/run.js` drives a real
headless Chrome on a throwaway profile and covers capture, repaint, the in-page
indicator, the reader, reader captures landing on the source page, concurrent
writes, and a backup round trip. No dependencies for either.

## [1.1.0] - 2026-04-15

### Highlight capture

Select text on any web page and save it into Offline Notes with one click. Each URL gets an auto-created "page note" that accumulates highlights over time. Returning to the page re-paints your saved highlights in place.

**Capture triggers** (three ways to save):
- Floating bubble — appears next to a selection; click to save.
- Right-click menu — "Save highlight to Offline Notes" on any selected text.
- Keyboard shortcut — `Alt+H` with text selected.

**Re-paint on revisit**: previously-saved highlights from a page reappear as soft cream-yellow marks when you return. The match is best-effort: anchors that no longer resolve (page content changed) are skipped silently; the stored highlight remains visible in the sidebar.

**Pages tab in the sidebar**: separate from manual notes. Lists page notes sorted by most-recently-highlighted. Click into a page note to see highlights with three per-highlight actions — copy as markdown quote, jump to the page (scrolls and flashes the mark), or delete.

**Per-tab badge** on the toolbar icon shows the saved-highlight count for the current URL.

### Visual refresh — warm paper / notebook identity

Everything visible in the extension has been redesigned around a single aesthetic: cream paper backgrounds, warm-dark ink, a sage green accent, Inter Display typography, and line-drawn icons. Applied to popup, sidebar, in-page bubble, toolbar badge, image templates, and the toolbar icon itself.

- **Popup and sidebar**: rewritten against new design tokens (`lib/tokens.css`). No IA changes — all existing flows, shortcuts, and data work identically.
- **Toolbar icon**: small cream notebook with a sage spine, replacing the gradient placeholder.
- **Image templates**: five fully-replaced warm-paper variants — `paper-default`, `paper-minimal`, `paper-quote`, `paper-card`, `paper-letterhead`. **Breaking change at the configuration level**: the old template names (`default`, `minimal`, `card`, `quote`, `modern`) no longer exist. Previously-exported images are not affected.
- **Empty states**: hand-drawn sage line-art illustrations for empty Notes, empty Pages, and no-matching-search states.

### New permissions

The highlight feature requires:
- `scripting`, `contextMenus` — Chrome APIs for content scripts and the right-click menu.
- `host_permissions: ["<all_urls>"]` — required to re-paint saved highlights on page load (which runs before any user gesture). Chrome shows a "Read and change all your data on websites you visit" warning at install time. **The extension makes zero network requests**; this access is used only to read selections and inject highlight marks locally.

### Fixes

- `background.js` no longer calls `sidePanel.open()` from `onInstalled` — that path always failed ("may only be called in response to a user gesture"). The side panel now opens only from real user gestures (popup link, `Alt+Shift+N`).
- `lib/image-generator.js`: templates now use block layout (not flex) to avoid html2canvas v1.4.1's known flex-centering issues. Added a null guard so an empty canvas surfaces a readable error instead of the cryptic `createObjectURL` overload failure.
- Sidebar empty state correctly distinguishes "no notes yet" from "no search results" — previously both showed the same illustration.

## [1.0.3] - 2025-11-09

### 🐛 Bug Fix: html2canvas CSP Violation

**Issue:** Extension failed to generate images with error "html2canvas library not loaded"

**Root Cause:**
- Chrome Manifest V3 has strict Content Security Policy (CSP)
- CSP blocks loading JavaScript from external CDNs
- sidebar.html was trying to load html2canvas from `cdnjs.cloudflare.com`
- Browser blocked the request silently

**Investigation Process (TDD/Ultrathink):**
1. ✅ Identified error message in extension console
2. ✅ Traced error to `lib/image-generator.js:40` - html2canvas undefined check
3. ✅ Analyzed sidebar.html - found CDN script tag on line 121
4. ✅ Researched Manifest V3 CSP restrictions
5. ✅ Determined local hosting was required

**Solution:**
1. Downloaded html2canvas v1.4.1 locally (194KB)
2. Saved to `/lib/html2canvas.min.js`
3. Updated `sidebar/sidebar.html` to load from local file
4. Updated `test-templates.html` for consistency
5. Created comprehensive TDD test suite
6. Verified all tests pass

**Files Changed:**
- `lib/html2canvas.min.js` - NEW (downloaded from CDN)
- `sidebar/sidebar.html` - Line 121: Changed CDN URL to `../lib/html2canvas.min.js`
- `test-templates.html` - Line 66: Changed CDN URL to `lib/html2canvas.min.js`
- `test-image-generation.html` - NEW (comprehensive TDD test suite)
- `TESTING.md` - NEW (testing documentation)
- `CHANGELOG.md` - NEW (this file)

**Testing:**
- ✅ All 12 automated tests pass
- ✅ Image generation works in extension
- ✅ All 5 templates render correctly
- ✅ No CSP violations in console
- ✅ Works 100% offline

**Impact:**
- Image generation now works correctly
- Extension is 100% offline (no CDN dependencies)
- Better security (no external script loading)
- Faster load times (no network requests)

---

## [1.0.2] - 2025-11-09

### 🐛 Bug Fix: Template Method Binding

**Issue:** Error "Cannot read properties of undefined (reading 'escapeHtml')"

**Root Cause:**
- Template methods lost `this` context when called as callbacks
- Methods were not bound in constructor

**Solution:**
- Bound all template methods using `.bind(this)` in constructor
- Added null checks for all note properties
- Created test-templates.html for verification

**Files Changed:**
- `lib/templates.js` - Complete rewrite with proper binding

---

## [1.0.1] - 2025-11-09

### 🐛 Bug Fix: Sidebar Opening Error

**Issue:** Error "No window with id: -2"

**Root Cause:**
- Using `chrome.windows.WINDOW_ID_CURRENT` constant
- Doesn't work properly in extension contexts

**Solution:**
- Query current tab first: `chrome.tabs.query({ active: true, currentWindow: true })`
- Use tab's windowId: `chrome.sidePanel.open({ windowId: tab.windowId })`
- Added "tabs" permission to manifest.json

**Files Changed:**
- `manifest.json` - Added "tabs" permission
- `background/background.js` - Updated sidebar opening logic
- `popup/popup.js` - Updated sidebar opening logic

---

## [1.0.0] - 2025-11-09

### 🎉 Initial Release

**Features:**
- ✨ Quick note creation via popup (Alt+N)
- ✨ Full note management in sidebar (Alt+Shift+N)
- ✨ Local storage only (no cloud/internet required)
- ✨ Markdown export (single note or bulk)
- ✨ Image generation with 5 beautiful templates:
  - Default: Gradient with glassmorphism
  - Minimal: Clean and simple
  - Card: Compact and colorful
  - Quote: Dark theme
  - Modern: Gradient header
- ✨ Real-time search and tag filtering
- ✨ Auto-save drafts (prevent data loss)
- ✨ Keyboard shortcuts
- ✨ Copy to clipboard support

**Technical Stack:**
- Chrome Manifest V3
- Vanilla JavaScript (no frameworks)
- html2canvas for image generation
- Chrome Storage API
- Side Panel API

**Files Created:**
- 16 core files
- 4 documentation files
- 3 testing/development tools
- Complete extension structure

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 1.0.3 | 2025-11-09 | Fixed html2canvas CSP violation |
| 1.0.2 | 2025-11-09 | Fixed template method binding |
| 1.0.1 | 2025-11-09 | Fixed sidebar opening error |
| 1.0.0 | 2025-11-09 | Initial release |

---

## Upgrade Instructions

### From 1.0.2 to 1.0.3
1. Reload extension in Chrome (`chrome://extensions/` → click reload)
2. Test image generation - should work without errors
3. No data migration required

### From 1.0.1 to 1.0.2
1. Reload extension in Chrome
2. Test template rendering
3. No data migration required

### From 1.0.0 to 1.0.1
1. Reload extension in Chrome
2. Test sidebar opening
3. No data migration required

---

## Known Issues

None currently. All reported bugs have been fixed.

---

## Roadmap

### Planned Features
- [ ] Export to PDF
- [ ] Import from Markdown
- [ ] Custom templates
- [ ] Sync across devices (optional)
- [ ] Dark mode
- [ ] Rich text editor
- [ ] Attachments support
- [ ] Note encryption

### Under Consideration
- [ ] Mobile companion app
- [ ] Browser-native sync
- [ ] Collaboration features
- [ ] API for integrations
- [ ] Plugin system

---

## Contributing

When reporting bugs, please include:
1. Extension version (check manifest.json)
2. Chrome version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (F12 → Console tab)
6. Screenshots if applicable

---

## Support

- 📚 Documentation: See README.md
- 🧪 Testing: See TESTING.md
- 🚀 Quick Start: See QUICKSTART.md
- 📦 Installation: See INSTALL.md

---

*This changelog follows [Keep a Changelog](https://keepachangelog.com/) format.*
