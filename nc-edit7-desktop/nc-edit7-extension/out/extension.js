"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const NCEditorProvider_1 = require("./NCEditorProvider");
let backendProcess;
function activate(context) {
    // Register our custom editor provider
    context.subscriptions.push(NCEditorProvider_1.NCEditorProvider.register(context));
    // 1. Spawning the Python Backend
    // Search for the python executable in the bundled extraResources (going up from the extension path)
    const possiblePaths = [
        path.join(context.extensionPath, '..', '..', '..', 'python_embedded', 'python.exe'), // Production build structure
        path.join(context.extensionPath, '..', 'python_embedded', 'python.exe') // Dev structure
    ];
    let pythonPath = possiblePaths.find(p => fs.existsSync(p));
    if (pythonPath) {
        // Production uses '../backend', dev uses '../../backend'
        const possibleBackendDirs = [
            path.join(path.dirname(pythonPath), '..', 'backend'), // Production
            path.join(path.dirname(pythonPath), '..', '..', 'backend') // Dev
        ];
        const backendDir = possibleBackendDirs.find(p => fs.existsSync(p)) || possibleBackendDirs[0];
        const backendScript = path.join(backendDir, 'main_import.py');
        console.log(`Starting embedded backend from: ${pythonPath}`);
        backendProcess = cp.spawn(pythonPath, ['-m', 'uvicorn', 'backend.main_import:app', '--port', '8000'], {
            cwd: path.join(backendDir, '..'),
            detached: false
        });
        backendProcess.stdout?.on('data', data => console.log(`Backend: ${data}`));
        backendProcess.stderr?.on('data', data => console.error(`Backend Error: ${data}`));
    }
    else {
        console.warn('Embedded Python not found. Assumed to be running externally or missing.');
    }
}
function deactivate() {
    if (backendProcess) {
        backendProcess.kill();
    }
}
//# sourceMappingURL=extension.js.map