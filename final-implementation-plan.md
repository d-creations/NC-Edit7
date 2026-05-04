# Final Implementation Plan: NC-Edit7 Theia Desktop App

This document outlines the current state and the remaining steps to fully integrate NC-Edit7 into a standalone desktop application using Eclipse Theia, an embedded Python backend, and a custom VS Code Editor Extension.

## 1. What is Already Done
* **Theia Desktop Shell (`nc-edit7-desktop/`)**: 
  * Created `package.json` with dependencies stripped down to only what is necessary (no Git, Debugger, etc.).
  * Added `download-python.js` to automatically download the **Windows Embeddable Python** distribution and configure it to embed cleanly.
* **Custom Editor Extension (`nc-edit7-extension/`)**:
  * Scaffolded the extension structure.
  * Created `NCEditorProvider.ts` to bridge the gap between Theia (VS Code UI) and the Vite frontend.
  * Webview messaging is wired up: it listens for `FILE_OPENED` from Theia and injects a script to listen for `vscode:file-changed` from the frontend.

## 2. What Needs to be Implemented

### Phase 1: Frontend Web Integration
1. **Modify `NCEditorApp.ts` and `FileManagerService.ts`**:
   * Add a listener on `window` for the `vscode:file-opened` event dispatched by the custom Webview provider.
   * When `vscode:file-opened` triggers, call `fileManager.openFile(text, name, { parseMultiChannel: true })` automatically.
   * Listen to Ace Editor change events across the 3 channels. When any channel changes, merge all 3 into a single string and emit `window.dispatchEvent(new CustomEvent('vscode:file-changed', { detail: mergedText }))`.
2. **Hide Internal File UI**:
   * Use CSS or a configuration flag to hide `<nc-file-manager>` and `<nc-program-manager>` when running inside the Theia extension context.

### Phase 2: Python Backend Execution
1. **App Bootstrapper**:
   * The Theia Electron app (or the extension itself) needs to spawn the embedded Python runtime as a background process upon startup.
   * Command to run: `..\python_embedded\python.exe -m uvicorn backend.main:app --port 8000` (or similar, depending on how `main.py` is invoked).
2. **Dynamic Port vs Static Port**:
   * Determine a port for the backend (e.g., `8000`) and ensure the frontend `BackendGateway.ts` points to `http://localhost:8000`.

### Phase 3: Build & Distribution (`electron-builder`)
1. **Consolidate Build Outputs**:
   * Ensure Vite builds the frontend into a `dist/` directory that the extension can read.
   * Compile the extension (`tsc -p ./`).
2. **Configure `electron-builder.yml`**:
   * Setup `nc-edit7-desktop/electron-builder.yml` to package:
     * The Theia application shell.
     * `extraResources`: Include the downloaded `python_embedded` folder and the `backend/` / `ncplot7py/` code.
     * The compiled VS Code Extension.
3. **Generate Installer**:
   * Run the `electron-builder` command to produce a single native `.exe` file that users can install without knowing about Python, VS Code, or Node.

## 3. Next Actionable Steps
1. Refactor `FileManagerService.ts` to support merging 3 channels back to text and hook up the VS Code message listeners.
2. Update the frontend UI to hide the internal file manager.
3. Create the startup script in the Theia app to run the Python backend.