import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { NCEditorProvider } from './NCEditorProvider';
import { WorkbenchPanelWebviewViewProvider } from './FocasWebviewViewProvider';

type WorkbenchTab = 'variables' | 'errors' | 'focas';

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

    const getEditorWebviewConfig = () => {
        const focasConfig = vscode.workspace.getConfiguration('ncEdit7.focas');
        const layoutConfig = vscode.workspace.getConfiguration('ncEdit7.layout');
        const themeMode = vscode.workspace.getConfiguration('ncEdit7').get<string>('theme.mode') || 'vscode';
        return {
            backendPort,
            focasDefaultIp: focasConfig.get<string>('defaultIpAddress') || '192.168.1.1',
            themeMode,
            hostMode: 'vscode-editor',
            focasPlacement: layoutConfig.get<string>('focasPlacement') || 'external-panel',
        };
    };

    const getPanelWebviewConfig = () => {
        const focasConfig = vscode.workspace.getConfiguration('ncEdit7.focas');
        const themeMode = vscode.workspace.getConfiguration('ncEdit7').get<string>('theme.mode') || 'vscode';
        return {
            backendPort,
            focasDefaultIp: focasConfig.get<string>('defaultIpAddress') || 'DEMO',
            themeMode,
            hostMode: 'vscode-panel',
            focasPlacement: 'disabled',
        };
    };

    type WorkbenchRelayMessage =
        | { type: 'OPEN_WORKBENCH_PANEL'; tab?: WorkbenchTab }
        | { type: 'FILES_OPENED'; isSingleFile: boolean; activeChannel: string; channels: Record<string, string> }
        | { type: 'FILE_UPDATED_EXTERNALLY'; channels: Record<string, string> }
        | { type: 'FILE_UPDATED_EXTERNALLY'; channel: string; text: string; activeChannel?: string }
        | { type: 'WORKBENCH_BRIDGE'; eventType: 'EXECUTION_COMPLETED'; payload: { channelId: string; result: { variableSnapshotEntries: Array<[number, number]>; errors: unknown[] } } }
        | { type: 'WORKBENCH_BRIDGE'; eventType: 'EXECUTION_ERROR'; payload: { channelId: string; error: { message: string } } }
        | { type: 'WORKBENCH_BRIDGE'; eventType: 'PLOT_CLEARED'; payload: Record<string, never> };

    const workbenchPanelProvider = new WorkbenchPanelWebviewViewProvider(context.extensionUri, backendPort);
    const editorProvider = new NCEditorProvider(context, backendPort, (message: WorkbenchRelayMessage) => {
        if (message.type === 'OPEN_WORKBENCH_PANEL') {
            void workbenchPanelProvider.reveal(message.tab);
            return;
        }

        void workbenchPanelProvider.postMessage(message);
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('ncEdit7.openWorkbenchPanel', async (tab?: 'variables' | 'errors' | 'focas') => {
            await workbenchPanelProvider.reveal(tab);
        })
    );

    // Register our custom editor provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            NCEditorProvider.viewType,
            editorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );
        
        // Register the composite NC workbench panel provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(WorkbenchPanelWebviewViewProvider.viewType, workbenchPanelProvider)
        );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration('ncEdit7') ||
                event.affectsConfiguration('ncEdit7.focas') ||
                event.affectsConfiguration('ncEdit7.layout')
            ) {
                editorProvider.updateConfig(getEditorWebviewConfig());
                void workbenchPanelProvider.updateConfig(getPanelWebviewConfig());
            }
        })
    );
	// Explicitly resolve the embedded backend from the pre-bundled dependencies
        const pythonPath = path.join(context.extensionPath, 'bundle', 'python_embedded', 'python.exe');
        const backendDir = path.join(context.extensionPath, 'bundle', 'backend');

        if (fs.existsSync(pythonPath) && fs.existsSync(backendDir)) {
                const backendScript = path.join(backendDir, 'main_import.py');
                console.log(`Starting embedded backend from: ${pythonPath} on port ${backendPort}`);

        backendProcess = cp.spawn(pythonPath, ['-m', 'uvicorn', 'main_import:app', '--app-dir', backendDir, '--port', backendPort.toString()], {
            cwd: backendDir,
                        detached: false
                });

                backendProcess.stdout?.on('data', data => console.log(`Backend: ${data}`));
		backendProcess.stderr?.on('data', data => console.error(`Backend Error: ${data}`));
		backendProcess.on('error', error => console.error(`Backend process failed to start: ${error.message}`));
		backendProcess.on('exit', code => console.log(`Backend process exited with code ${code ?? 'null'}`));
	} else {
		console.warn('Embedded Python not found. Assumed to be running externally or missing.');
	}
}

export function deactivate() {
	if (backendProcess) {
		backendProcess.kill();
	}
}

