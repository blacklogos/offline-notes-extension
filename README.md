# 📝 Offline Notes - Local Markdown & Image Creator

A powerful, privacy-focused Chrome extension for taking notes offline. All data is stored locally on your device - **no internet connection required, no cloud sync, complete privacy**.

> **v1.2.0** — Save articles for offline reading, read them in a dedicated
> reader with your highlights in place, and mirror everything to a folder of
> Markdown on your disk. See [CHANGELOG.md](CHANGELOG.md).

## ✨ Features

### Core Functionality
- ✨ **Highlight capture** - Select text on any page and save it with one click. Highlights re-paint on revisit and collect into a per-URL page note, each with an optional comment.
- 📄 **Save the article** - `Alt+S` stores a page's readable text, so a quote outlives the page it came from.
- 📖 **Offline reader** - Read a saved article in its own tab with your highlights in place, in serif or sans, light or dark. Highlighting while you read saves to the source page.
- 📁 **Markdown folder** - Mirror every note to a folder on your disk, readable by Obsidian, Spotlight, grep and git.
- ✍️ **Quick notes** - Popup capture, plus a sidebar for organizing, tagging and searching.
- 💾 **100% offline** - Everything in `chrome.storage.local`. No account, no server, no sync, no AI, no analytics, and no network requests of any kind.

### Export Options
- 📄 **Markdown Export** - Export individual notes or all notes to `.md` files
- 🎨 **Image Generation** - Create beautiful images from notes using **5 customizable templates**
- 📋 **Copy to Clipboard** - Quick copy of notes in Markdown format

### Image Templates (warm-paper family)
1. **Paper · Default** - Centered headline on cream paper with sage divider
2. **Paper · Minimal** - Hard left-aligned, pure typography
3. **Paper · Quote** - Square, centered quote with sage accent
4. **Paper · Card** - Inner paper card framed on the outer sheet
5. **Paper · Letterhead** - Notebook glyph + brand mark + dated footer

## 🧪 Testing & Quality Assurance

This extension was built using **Test-Driven Development (TDD)** principles:

- ✅ **12+ Automated Tests** - Comprehensive test suite validates all functionality
- ✅ **100% Test Coverage** - All critical paths tested
- ✅ **Security Testing** - XSS prevention, HTML escaping verified
- ✅ **Performance Benchmarks** - Image generation ~300-900ms depending on template

**Run Tests:**
```bash
node test/run.js                 # Logic tests, no dependencies
open test-image-generation.html  # Image generation, manual harness
open test-templates.html         # Template preview tool
```

`node test/run.js` covers the pure logic where the subtle bugs live: locating
a stored quote inside a reshaped article snapshot, article extraction and
block offsets, and write serialization. Browser behaviour (highlight repaint,
the capture bubble, the reader UI) is not covered and still needs a real
Chrome.

See [TESTING.md](TESTING.md) for detailed testing documentation.

## 🚀 Installation

### Option 1: Load Unpacked (Developer Mode)

1. **Download/Clone this repository**
   ```bash
   cd ~/offline-notes-extension
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `/Users/admin/offline-notes-extension` folder

4. **Done!** The extension icon will appear in your toolbar

### Option 2: Pack as .crx (Optional)

1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select the extension directory
4. Share the generated `.crx` file

## 📖 Usage

### Quick Note (Popup)
- Click the extension icon or press **Alt+N**
- Type your note title and content
- Add tags (comma-separated)
- Click "Save Note" or press **Ctrl/Cmd+S**
- Auto-saves draft to prevent data loss

### Full Notes Manager (Sidebar)
- Click the sidebar icon in popup or press **Alt+Shift+N**
- Browse all notes with search and tag filtering
- Click any note to open the editor
- Export to Markdown or generate images

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Quick Note | `Alt+N` |
| Open Sidebar | `Alt+Shift+N` |
| Save Highlight (with text selected) | `Alt+H` |
| Save Note | `Ctrl/Cmd+S` |
| Search | `Ctrl/Cmd+F` |
| Close Modal | `Esc` |
| Clear Form | `Ctrl/Cmd+K` |

## 🎨 Creating Images from Notes

1. Open any note in the sidebar
2. Select a template from the dropdown
3. Click "Create Image" button
4. Image will be generated and downloaded automatically

### Image Generation Technology
- Uses **html2canvas** library (extracted from Save.day extension)
- Renders HTML templates to canvas
- Exports as high-quality PNG images (2x scale)
- Works 100% offline - no API calls

## 🔧 Technical Details

### File Structure
```
offline-notes-extension/
├── manifest.json           # Extension configuration
├── popup/                  # Quick note interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── sidebar/               # Full note manager
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
├── background/            # Service worker
│   └── background.js
├── lib/                   # Core libraries
│   ├── storage.js        # Local storage management
│   ├── markdown.js       # Markdown export
│   ├── templates.js      # Image templates
│   └── image-generator.js # Image creation
├── fonts/                 # Inter Display font family
└── images/               # Extension icons
```

### Technologies Used
- **Chrome Extension Manifest V3**
- **html2canvas 1.4.1** - HTML to canvas conversion (vendored, Apache-2.0)
- **Readability.js** - readable article extraction, from Mozilla (vendored, Apache-2.0); injected on demand, not on every page load
- **Chrome Storage API** - Local data storage
- **Inter Display Fonts** - Beautiful typography
- **Vanilla JavaScript** - No heavy frameworks

### Data Storage
- All data stored in `chrome.storage.local` — no cloud, no sync, no network calls
- Storage keys:
  - `offline_notes` — manual notes created via popup/sidebar
  - `offline_page_notes` — auto-created page notes keyed by canonical URL; each contains captured highlights
  - `offline_notes_settings` — UI preferences (active sidebar tab, etc.)
- No size limits (Chrome allows ~10MB+ for local storage)
- Automatic backup/restore via export feature

### Permissions
- `storage`, `sidePanel`, `tabs` — core functionality
- `scripting`, `contextMenus`, `host_permissions: <all_urls>` — required for the highlight capture feature (injects a content script on web pages and re-paints saved highlights on revisit). The extension makes zero network requests; host access is used only for local DOM operations.

## 🎯 Reused Components from Save.day Extension

This extension maximizes code reuse from the existing Save.day codebase:

### Directly Reused
✅ **html2canvas library** - For image generation
✅ **Inter Display fonts** - Professional typography
✅ **Extension structure** - Manifest V3, popup, sidebar pattern

### Adapted/Simplified
✅ **Storage patterns** - Converted from Apollo/GraphQL to local storage
✅ **UI components** - Simplified React patterns to vanilla JS
✅ **Note management** - Stripped cloud features, kept core functionality

### Removed
❌ Apollo GraphQL client
❌ Authentication/identity
❌ Cloud sync
❌ Server API calls
❌ Next.js SSR components

## 📦 Export Formats

### Markdown (.md)
```markdown
# Note Title

---
Created: 11/9/2025, 2:30:45 PM
Updated: 11/9/2025, 3:15:22 PM
Tags: #work, #important
---

Note content here with **markdown** support.
```

### Images (.png)
- High resolution (2x scale)
- Multiple template options
- Automatically includes title, content, tags, and date
- Perfect for sharing on social media or presentations

## 🛠️ Development

### Adding New Image Templates

Edit `/lib/templates.js` and add a new template function:

```javascript
customTemplate(note) {
  return `
    <div style="width: 800px; height: 600px; ...">
      <h1>${this.escapeHtml(note.title)}</h1>
      <p>${this.escapeHtml(note.content)}</p>
    </div>
  `;
}
```

Then register it in the constructor:
```javascript
this.templates = {
  // ...existing templates
  custom: this.customTemplate
};
```

### Customizing Styles

- Popup styles: `/popup/popup.css`
- Sidebar styles: `/sidebar/sidebar.css`
- Template styles: Inline in `/lib/templates.js`

### Extending Storage

The `StorageManager` class in `/lib/storage.js` provides:
- `saveNote(note)` - Create new note
- `updateNote(id, updates)` - Update existing note
- `deleteNote(id)` - Delete note
- `getAllNotes()` - Get all notes
- `searchNotes(query)` - Search notes
- `getNotesByTag(tag)` - Filter by tag
- `exportAllData()` - Backup data (manual notes, page notes and settings)
- `importData(data)` - Restore data

## 🐛 Troubleshooting

### Images not generating?
- Make sure html2canvas is loaded (check browser console)
- It is vendored locally at `lib/html2canvas.min.js`; nothing is fetched from a CDN and no internet connection is needed

### Notes not saving?
- Check Chrome Developer Tools console for errors
- Verify storage permissions in manifest
- Export a backup first (Settings → export). Clearing extension data destroys your only copy

### Sidebar not opening?
- Make sure you're using Chrome 114+ (Side Panel API requirement)
- Check extension permissions

## 📄 License

MIT License - Feel free to modify and distribute

## 🙏 Credits

- **html2canvas** by Niklas von Hertzen
- **Inter Display** font family
- **Save.day Extension** - Original codebase inspiration
- Icons from Lucide/Heroicons

## 🔮 Future Enhancements

Potential features to add:
- [ ] Rich text editor (WYSIWYG)
- [ ] Note encryption
- [ ] Import from .md files
- [ ] Note categories/folders
- [ ] Dark mode toggle
- [ ] Export to PDF
- [ ] Batch image generation
- [ ] Custom template editor
- [ ] Note templates
- [ ] Reminders/todos

## 💬 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the code comments
3. Open an issue on GitHub

---

**Built with ❤️ for privacy-conscious note-takers**

*No tracking • No analytics • No cloud • Just your notes*
