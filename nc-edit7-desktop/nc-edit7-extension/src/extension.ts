import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { NCEditorProvider } from './NCEditorProvider';

let backendProcess: cp.ChildProcess | undefined;

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = (srv.address() as net.AddressInfo).port;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

export async function activate(context: vscode.ExtensionContext) {
	const backendPort = await getFreePort();

	// Register our custom editor provider
	context.subscriptions.push(NCEditorProvider.register(context, backendPort));

	// 1. Spawning the Python Backend
	// Search for the python executable in the bundled extraResources (going up from the extension path)
	const possiblePaths = [
		path.join(context.extensionPath, '..', '..', '..', 'python_embedded', 'python.exe'), // Production build structure
		path.join(context.extensionPath, '..', 'python_embedded', 'python.exe')              // Dev structure
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
                console.log(`Starting embedded backend from: ${pythonPath} on port ${backendPort}`);

                backendProcess = cp.spawn(pythonPath, ['-m', 'uvicorn', 'backend.main_import:app', '--port', backendPort.toString()], {
                        cwd: path.join(backendDir, '..'),
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

