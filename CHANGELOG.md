# Changelog

All notable changes to this project will be documented in this file.

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
