import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { NCEditorProvider } from './NCEditorProvider';
import { FocasWebviewViewProvider } from './FocasWebviewViewProvider';

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
        
        // Register FOCAS WebviewViewProvider (bottom panel)
        const focasProvider = new FocasWebviewViewProvider(context.extensionUri, backendPort);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(FocasWebviewViewProvider.viewType, focasProvider)
        );
	// Explicitly resolve the embedded backend from the pre-bundled dependencies
        const pythonPath = path.join(context.extensionPath, 'bundle', 'python_embedded', 'python.exe');
        const backendDir = path.join(context.extensionPath, 'bundle', 'backend');

        if (fs.existsSync(pythonPath) && fs.existsSync(backendDir)) {
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

