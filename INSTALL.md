# 🛠️ Complete Installation Guide

## Prerequisites
- Google Chrome (v114 or later recommended)
- Basic computer skills
- 5 minutes of time

## Step-by-Step Installation

### 1. Generate Extension Icons (One-Time Setup)

The extension needs icon files to display properly in Chrome.

**Option A: Use the Icon Generator (Recommended)**
1. Open `generate-icons.html` in your browser
2. Click "Download All Icons"
3. You'll get 3 PNG files: `icon128.png`, `icon48.png`, `icon16.png`
4. Move these files to the `/images/` folder

**Option B: Use Placeholder Icons**
- The extension will work without custom icons
- Chrome will use default icons

### 2. Load Extension in Chrome

1. **Open Chrome Extensions Page**
   ```
   Type in address bar: chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Look for toggle switch in top-right corner
   - Turn it ON

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to: `/Users/admin/offline-notes-extension`
   - Click "Select" or "Choose"

4. **Verify Installation**
   - You should see "Offline Notes - Local Markdown & Image Creator"
   - Status should be "Enabled"
   - Extension icon appears in toolbar

### 3. Pin Extension (Recommended)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Offline Notes" in the list
3. Click the pin icon to keep it visible

### 4. Grant Permissions (Automatic)

The extension requests these permissions:
- ✅ **Storage** - Save notes locally
- ✅ **Side Panel** - Display full note manager

Chrome will prompt for these automatically. Click "Allow".

## First Run

### Test the Popup
1. Click the extension icon
2. You should see the Quick Note interface
3. Try creating a test note

### Test the Sidebar
1. Click the sidebar icon in popup (or press Alt+Shift+N)
2. Full note manager should open on the right side
3. You should see your test note

### Test Image Generation
1. Open a note in the sidebar
2. Select "Default" template
3. Click "Create Image"
4. Image should download automatically

## Troubleshooting

### ❌ Extension Won't Load

**Error: "Cannot load extension"**
- Make sure you selected the correct folder
- Folder should contain `manifest.json`
- Check file permissions

**Error: "Manifest file is missing or unreadable"**
- Verify `manifest.json` exists in root folder
- Check JSON syntax (use a JSON validator)

### ❌ Icons Not Showing

**Default gray icons appear**
- Generate icons using `generate-icons.html`
- Place PNG files in `/images/` folder
- Reload extension (trash icon → reload arrow)

### ❌ Sidebar Won't Open

**Side panel not working**
- Update Chrome to version 114 or later
- Try `chrome://flags/#side-panel` and enable
- Restart Chrome

### ❌ Images Won't Generate

**"html2canvas not loaded" error**
- First generation needs internet for CDN
- After first load, works offline
- Check browser console for errors

### ❌ Notes Not Saving

**Storage errors**
- Check extension permissions
- Look for errors in console (F12)
- Try clearing extension storage:
  ```
  chrome://extensions/ → Details → "Clear storage"
  ```

## Updating the Extension

### Quick Reload
1. Go to `chrome://extensions/`
2. Find "Offline Notes"
3. Click reload icon (circular arrow)

### Full Reinstall
1. Remove extension
2. Delete and re-download files
3. Load unpacked again

## Uninstalling

### Remove Extension
1. Go to `chrome://extensions/`
2. Find "Offline Notes"
3. Click "Remove"

### Backup Before Uninstall
1. Open sidebar
2. Click export button (top-right)
3. Download all notes as Markdown
4. Or use browser's export data feature

## Advanced Setup

### Custom html2canvas (For Complete Offline Use)

Instead of loading from CDN, extract from Save.day extension:

1. Navigate to Save.day extension folder:
   ```
   /Users/admin/Library/Application Support/Google/Chrome/Profile 1/Extensions/gmfaoihlkhopieoibopcponemocgbloj/2.2.2_0/js/
   ```

2. The file `index.js` contains html2canvas bundled code

3. Extract html2canvas portion (it's minified, starts with html2canvas license comment)

4. Save as `/lib/html2canvas.min.js`

5. Update `sidebar/sidebar.html` to load from local file:
   ```html
   <!-- Change this line: -->
   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

   <!-- To this: -->
   <script src="../lib/html2canvas.min.js"></script>
   ```

6. Reload extension

Now image generation works 100% offline!

### Customize Templates

Edit `/lib/templates.js` to modify image templates:

```javascript
// Example: Change default template colors
defaultTemplate(note) {
  return `
    <div style="
      background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
      // ... rest of template
    ">
  `;
}
```

### Add Custom Fonts

1. Download font files (.woff2 format)
2. Place in `/fonts/` folder
3. Update CSS files to reference new fonts

## Permissions Explained

### Why We Need Storage Permission
- Save notes to your local computer
- No data sent to servers
- Data stays in Chrome's local storage

### Why We Need Side Panel Permission
- Display full-featured note manager
- Alternative to opening new tabs
- Native Chrome UI integration

### What We DON'T Access
- ❌ No browsing history
- ❌ No passwords
- ❌ No cookies
- ❌ No personal data
- ❌ No internet access (after initial html2canvas load)

## Security & Privacy

### Data Storage Location
```
Chrome Profile → Extensions → Storage
Path: chrome://settings/siteData
```

### Data Format
```javascript
{
  "offline_notes": [
    {
      "id": "note_1234567890_abc123",
      "title": "My Note",
      "content": "Note content...",
      "tags": ["tag1", "tag2"],
      "createdAt": "2025-11-09T...",
      "updatedAt": "2025-11-09T..."
    }
  ]
}
```

### Backup Your Data
Regular backups recommended:
1. Export all notes to Markdown (weekly)
2. Or use Chrome's built-in sync (if enabled)
3. Or manually copy storage data

## Getting Help

### Check Logs
1. Right-click extension icon
2. Select "Inspect popup"
3. Check Console tab for errors

### Debug Sidebar
1. Open sidebar
2. Press F12 (Developer Tools)
3. Check Console for errors

### Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Popup blank | Check console for JS errors |
| Sidebar won't open | Update Chrome to v114+ |
| Images fail | Check html2canvas loaded |
| Notes not saving | Verify storage permission |
| Slow performance | Clear old notes, export to file |

## Next Steps

After successful installation:

1. ✅ Read `QUICKSTART.md` for basic usage
2. ✅ Read `README.md` for full features
3. ✅ Try all 5 image templates
4. ✅ Set up keyboard shortcuts
5. ✅ Export your first note to Markdown

---

**Still having issues?** Check the code comments or browser console for detailed error messages.

**Enjoy your new offline note-taking system!** 🎉
