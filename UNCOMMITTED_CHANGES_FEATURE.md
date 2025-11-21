# Uncommitted Changes Detection Feature

## Overview
This feature warns users when they attempt to navigate away from the page with unsaved changes in the CNC editor, preventing accidental data loss.

## Implementation Details

### 1. Global State Tracking (`originalCode/index.html`)
- Added a global flag `window.hasUncommittedChanges` to track whether there are unsaved changes
- Implemented a `beforeunload` event handler that displays a warning dialog when the flag is `true`

### 2. Change Detection (`originalCode/js/src/domain/canal.js`)
- Modified the ACE editor's `change` event handler to set `window.hasUncommittedChanges = true` when content is modified
- This ensures any edit to the code triggers the uncommitted changes flag

### 3. Reset on Save (`originalCode/js/src/domain/WebPageFileHandler.ts`)
- Added logic to clear the flag (`window.hasUncommittedChanges = false`) in the `storeTextExec` method
- This ensures the flag is reset after successfully saving content

### 4. Reset on Load (`originalCode/js/src/domain/filehandler.ts` and `WebPageFileHandler.ts`)
- Added logic to clear the flag in the `setTextToTextArea` methods
- This ensures loading a new file starts with a clean state

## User Experience

### When there are uncommitted changes:
1. User makes edits to the CNC code in the editor
2. User attempts to navigate away (close tab, refresh, navigate to another page)
3. Browser displays a confirmation dialog: "You have uncommitted changes. Are you sure you want to leave?"
4. User can choose to stay or leave

### When there are no uncommitted changes:
1. User loads or saves a file
2. User attempts to navigate away
3. No warning is displayed, and navigation proceeds normally

## Browser Compatibility
This implementation uses the standard `beforeunload` event, which is supported by all modern browsers including:
- Chrome/Edge (Chromium)
- Firefox
- Safari

Note: Modern browsers may customize the message shown to users for security reasons, but the warning will still appear.

## Testing
To test this feature:
1. Open the application in a browser
2. Make changes to the CNC code in the editor
3. Try to close the tab or navigate away
4. Verify the warning dialog appears
5. Save the file
6. Try to close the tab again
7. Verify no warning appears

## Files Modified
- `originalCode/index.html` - Added global flag and beforeunload handler
- `originalCode/js/src/domain/canal.js` - Set flag on editor changes
- `originalCode/js/src/domain/WebPageFileHandler.ts` - Clear flag on save/load
- `originalCode/js/src/domain/filehandler.ts` - Clear flag on file load
- `originalCode/js/src/domain/WebPageFileHandler.js` - Compiled JavaScript (auto-generated)
- `originalCode/js/src/domain/filehandler.js` - Compiled JavaScript (auto-generated)
