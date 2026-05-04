import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { NCEditorProvider } from './NCEditorProvider';

let backendProcess: cp.ChildProcess | undefined;

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor provider
	context.subscriptions.push(NCEditorProvider.register(context));

	// 1. Spawning the Python Backend
	// Search for the python executable in the bundled extraResources (going up from the extension path)
	const possiblePaths = [
		path.join(context.extensionPath, '..', '..', '..', 'python_embedded', 'python.exe'), // Production build structure
		path.join(context.extensionPath, '..', 'python_embedded', 'python.exe')              // Dev structure
	];

	let pythonPath = possiblePaths.find(p => fs.existsSync(p));
	
	if (pythonPath) {
		const backendScript = path.join(path.dirname(pythonPath), '..', 'backend', 'main_import.py');
		console.log(`Starting embedded backend from: ${pythonPath}`);
		
		backendProcess = cp.spawn(pythonPath, ['-m', 'uvicorn', 'backend.main_import:app', '--port', '8000'], {
			cwd: path.join(path.dirname(pythonPath), '..'),
			detached: false
		});

		backendProcess.stdout?.on('data', data => console.log(`Backend: ${data}`));
		backendProcess.stderr?.on('data', data => console.error(`Backend Error: ${data}`));
	} else {
		console.warn('Embedded Python not found. Assumed to be running externally or missing.');
	}
}

export function deactivate() {
	if (backendProcess) {
		backendProcess.kill();
	}
}
