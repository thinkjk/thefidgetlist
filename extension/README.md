# Fidget List Quick Add - Browser Extension

A Firefox browser extension to streamline adding fidget items to The Fidget List.

## Development Status

**Phase 1: MVP - Basic Extension & Queue System** ✅ COMPLETED

### 1.1 Extension Scaffold ✅
- ✅ Extension directory structure
- ✅ Manifest.json for Firefox
- ✅ Icons (16x16, 48x48, 128x128)
- ✅ Basic popup UI (manual entry form)
- ✅ Queue Manager UI
- ✅ Settings page
- ✅ Content script for page scraping
- ✅ Background script with context menu

### 1.2 Queue Storage ✅
- ✅ IndexedDB implementation (`utils/storage.js`)
- ✅ CRUD operations for queue items
- ✅ Popup form connected to storage
- ✅ Queue Manager displays stored items
- ✅ Blob storage for images

### 1.3 Form Validation ✅
- ✅ Validator utility (`utils/validator.js`)
- ✅ Dimension format validation and normalization
- ✅ Weight format validation and normalization
- ✅ Button size validation
- ✅ Image URL validation
- ✅ Complete form validation

### 1.4 Enhanced Auto-Detection ✅
- ✅ Extract page title, description, images
- ✅ Parse dimensions, weight, materials from text
- ✅ Detect group from known domains
- ✅ Visual feedback for auto-filled fields
- ✅ Support for Shopify, Facebook, and generic sites
- ✅ Multiple parsing patterns for different website formats

### 1.5 Image Download & Conversion ✅
- ✅ Download images from URLs
- ✅ Convert to JPEG format (from any format)
- ✅ Auto-generate filenames (fidget_name_material.jpg)
- ✅ Store as blobs in IndexedDB
- ✅ Display thumbnails in Queue Manager
- ✅ Generate group slugs for folder structure

### 1.6 UX Improvements ✅
- ✅ Variant remove button logic (hide when only 1 variant)
- ✅ Keyboard shortcuts (Ctrl+Enter, Ctrl+K, etc.)
- ✅ Auto-detect mode feedback
- ✅ JSON preview and export
- ✅ Delete queue items
- ✅ Progress indicators for image downloads

**Phase 2: Enhanced Parsing & AI Integration** ✅ COMPLETED

### 2.1 Advanced Text Parser ✅
- ✅ Comprehensive text parsing utility (`utils/text-parser.js`)
- ✅ Multiple pattern matching for different website formats
- ✅ Parse finish/coating types
- ✅ Parse prices
- ✅ Extract product descriptions intelligently

### 2.2 Ollama AI Integration ✅
- ✅ Optional AI-powered parsing (`utils/ollama-client.js`)
- ✅ Configurable endpoint and model
- ✅ JSON-based extraction with validation
- ✅ Timeout handling (5 second max)
- ✅ Fallback to regex if Ollama unavailable
- ✅ Connection testing in Settings

### 2.3 Enhanced Scraping ✅
- ✅ Improved dimension parsing (5 different patterns)
- ✅ Better material detection (checks title first)
- ✅ Finish/coating detection
- ✅ Price extraction
- ✅ Meta tag parsing for full specs

**Phase 3: GitHub Integration & PR Creation** ✅ COMPLETED

### 3.1 GitHub API Client ✅
- ✅ GitHub API authentication with token
- ✅ Repository operations (get repo, list branches)
- ✅ Branch creation and management
- ✅ File operations (get, create, update)
- ✅ Pull request creation
- ✅ Rate limiting detection

### 3.2 JSON Merging ✅
- ✅ Fetch current fidgets.json and groups.json
- ✅ Merge queue items into existing data
- ✅ Duplicate detection
- ✅ JSON schema validation
- ✅ Diff preview generation

### 3.3 Image Upload ✅
- ✅ Convert blobs to base64 for GitHub API
- ✅ Upload images to repository
- ✅ Handle existing files (update with SHA)
- ✅ Batch upload with progress tracking
- ✅ Retry failed uploads

### 3.4 PR Creator Workflow ✅
- ✅ Complete PR creation workflow
- ✅ Auto-generate branch names
- ✅ Upload all images with progress
- ✅ Merge and validate JSON files
- ✅ Create commits with descriptive messages
- ✅ Generate PR title and description
- ✅ Progress tracking callbacks

### 3.5 Queue Manager Integration ✅
- ✅ Load GitHub scripts in queue manager
- ✅ "Create Pull Request" button functionality
- ✅ Progress modal with step-by-step updates
- ✅ Success modal with PR details and stats
- ✅ Error handling and user feedback
- ✅ Option to clear queue after PR creation

**Next Steps (Phase 4):**
- Polish and testing
- Error handling improvements
- GitHub connection test in Settings
- Documentation
- Firefox Add-ons submission

## Testing in Firefox

### Load the Extension

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Navigate to this directory and select `manifest.json`
5. The extension should now appear in your toolbar

### Test the Extension

1. **Click the extension icon** in the toolbar
   - Should open the popup with the manual entry form
   - Try entering fidget details
   - Click "Open Queue Manager" to see the queue page
   - Click "Settings" to see the settings page

2. **Right-click on any page**
   - Should see "Add to Fidget Queue" context menu item

3. **Check the browser console**
   - Open the page you're testing on
   - Press F12 to open developer tools
   - Go to Console tab
   - You should see "Fidget List Quick Add: Content script loaded"

4. **Check the extension console**
   - Go back to `about:debugging`
   - Find the extension and click "Inspect"
   - Check for any errors

## File Structure

```
extension/
├── manifest.json              # Extension manifest
├── background/
│   └── background.js         # Background script (context menu)
├── content/
│   ├── content.js            # Page scraping logic
│   └── selectors.js          # Site-specific selectors
├── popup/
│   ├── popup.html            # Main popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup logic
├── queue/
│   ├── queue-manager.html    # Queue management page
│   ├── queue-manager.css     # Queue styles
│   └── queue-manager.js      # Queue logic
├── settings/
│   ├── settings.html         # Settings page
│   ├── settings.css          # Settings styles
│   └── settings.js           # Settings logic
├── utils/                     # Utility scripts (to be added)
└── icons/
    ├── icon.svg              # Source icon
    ├── icon-16.png           # 16x16 icon
    ├── icon-48.png           # 48x48 icon
    └── icon-128.png          # 128x128 icon
```

## Features Implemented

**Working Features:**
- ✅ Manual entry form with validation
- ✅ Auto-detection from product pages
- ✅ Queue storage (IndexedDB)
- ✅ Queue Manager (view, delete, preview, export)
- ✅ Form validation with auto-normalization
- ✅ Keyboard shortcuts
- ✅ Visual feedback for auto-detection
- ✅ Support for known maker domains

**Not Yet Implemented:**
- [ ] Image downloading to local storage
- [ ] Advanced Shopify scraping
- [x] Facebook post scraping (basic support - extracts text, images, parses specs)
- [ ] Ollama AI integration
- [ ] GitHub PR creation
- [ ] Edit queue items

## Development Notes

- Extension uses Firefox WebExtensions API (Manifest V2)
- Uses `browser.*` namespace (Firefox standard)
- All storage will use `browser.storage.local` and IndexedDB
- Content scripts run on all URLs for maximum flexibility

## Usage

### Adding a Fidget

1. **Navigate to a product page** (e.g., CleanEDC, Shopify store, etc.)
2. **Click the extension icon** in the toolbar
3. **Auto-detect mode** will try to extract:
   - Product name
   - Group name (if known domain)
   - Dimensions, weight, material (if in description)
   - Product image
4. **Review and edit** the auto-filled fields
5. **Add variants** if needed (different materials/colors)
6. **Click "Add to Queue"** or press Ctrl+Enter

### Managing the Queue

1. Click **"Open Queue Manager"** or press Ctrl+Shift+Q
2. **View all queued items** with details
3. **Delete items** you don't want
4. **Preview JSON** to see the raw data
5. **Export JSON** to copy to clipboard

### Keyboard Shortcuts

- **Ctrl+Enter**: Submit form (add to queue)
- **Ctrl+K**: Focus on fidget name field
- **Ctrl+Shift+A**: Add new variant
- **Ctrl+Shift+Q**: Open queue manager

## Known Issues

- Edit functionality not yet implemented (delete and re-add instead)
- Images are stored as URLs only (not downloaded locally yet)
- Some Shopify sites may not auto-detect properly (use manual entry)

## Next Phase

Phase 1.3: Implement IndexedDB queue storage and working form submission.
