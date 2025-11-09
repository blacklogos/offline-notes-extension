# 🚀 Quick Start Guide

## Installation (2 minutes)

### Step 1: Open Chrome Extensions
1. Open Chrome browser
2. Type `chrome://extensions/` in the address bar
3. Press Enter

### Step 2: Enable Developer Mode
1. Look for the toggle in the top-right corner
2. Turn ON "Developer mode"

### Step 3: Load the Extension
1. Click "Load unpacked" button
2. Navigate to: `/Users/admin/offline-notes-extension`
3. Click "Select Folder"

### Step 4: Pin to Toolbar (Optional)
1. Click the puzzle piece icon in Chrome toolbar
2. Find "Offline Notes"
3. Click the pin icon

## ✅ You're Ready!

### Create Your First Note
1. Click the extension icon
2. Type a title: "My First Note"
3. Write some content
4. Add tags: "test, getting-started"
5. Click "Save Note" or press Ctrl+S

### Open Full Note Manager
1. Click the sidebar icon in the popup
2. OR press Alt+Shift+N
3. See all your notes with search and filters

### Generate Your First Image
1. Open the sidebar
2. Click on any note
3. Select a template (try "Modern")
4. Click "Create Image"
5. Image downloads automatically!

## 📋 Keyboard Shortcuts

```
Alt+N              → Open quick note
Alt+Shift+N        → Open sidebar
Ctrl/Cmd+S         → Save note
Ctrl/Cmd+F         → Search notes
Ctrl/Cmd+K         → Clear form
Esc                → Close modal/popup
```

## 🎨 Try All 5 Image Templates

1. **Default** - Purple gradient with glassmorphism
2. **Minimal** - Clean white background
3. **Card** - Compact colorful card
4. **Quote** - Dark theme for quotes
5. **Modern** - Gradient header with dark body

## 💡 Pro Tips

- **Auto-save**: Your draft is saved automatically while typing
- **Search**: Use search to find notes by title, content, or tags
- **Tags**: Click tags in sidebar to filter notes
- **Markdown**: Notes support basic markdown in exports
- **Privacy**: Everything stays on your device - 100% offline

## 🔧 Troubleshooting

**Sidebar won't open?**
- Make sure you're using Chrome 114 or later
- Some Chrome profiles may not support Side Panel API

**Images not generating?**
- First time needs internet to load html2canvas from CDN
- After that, works completely offline

**Notes disappeared?**
- Check if extension is still enabled
- Data is stored in chrome.storage.local
- Export notes regularly as backup

## 📚 Next Steps

1. Read the full README.md for advanced features
2. Explore all 5 image templates
3. Try exporting notes to Markdown
4. Customize templates in `/lib/templates.js`

---

**Need help?** Check README.md or review the code comments
