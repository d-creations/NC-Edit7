import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FocasWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'nc-edit7.focasView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _backendPort: number
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        const distPath = vscode.Uri.joinPath(this._extensionUri, 'bundle', 'dist');
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri, distPath]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, distPath);

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'SAVE_FOCAS_FILE':
                        try {
                            if (!vscode.workspace.workspaceFolders) {
                                vscode.window.showErrorMessage("Open a workspace folder first to pull files.");
                                return;
                            }
                            const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                            let targetFileName = message.fileName;
                            let filePath = path.join(wsPath, targetFileName);
                            
                            // Check if file already exists
                            if (fs.existsSync(filePath)) {
                                const choice = await vscode.window.showWarningMessage(
                                    `File ${targetFileName} already exists in the workspace. Overwrite it?`,
                                    { modal: true },
                                    "Overwrite", "Save as Copy"
                                );
                                
                                if (!choice) return; // User cancelled
                                
                                if (choice === "Save as Copy") {
                                    const ext = path.extname(targetFileName);
                                    const base = path.basename(targetFileName, ext);
                                    let counter = 1;
                                    targetFileName = `${base}_Copy${ext}`;
                                    filePath = path.join(wsPath, targetFileName);
                                    
                                    while (fs.existsSync(filePath)) {
                                        counter++;
                                        targetFileName = `${base}_Copy_${counter}${ext}`;
                                        filePath = path.join(wsPath, targetFileName);
                                    }
                                }
                            }

                            // Save file physically to workspace root
                            fs.writeFileSync(filePath, message.content, 'utf8');
                            
                            // Open it explicitly with our custom editor!
                            await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(filePath), 'ncEdit7.editor');
                            vscode.window.showInformationMessage(`Pulled ${targetFileName} to workspace.`);
                        } catch (err) {
                            vscode.window.showErrorMessage(`Failed to pull FOCAS file: ${err}`);
                        }
                        break;
                    case 'UPLOAD_DROPPED_VSCODE_FILE':
                        try {
                            let targetFsPath = '';
                            if (message.codeResources && message.codeResources.length > 5) {
                                targetFsPath = vscode.Uri.parse(JSON.parse(message.codeResources)[0]).fsPath;
                            } else if (message.uriList && message.uriList.length > 5) {
                                targetFsPath = vscode.Uri.parse(message.uriList.split('\n')[0].trim()).fsPath;
                            } else if (message.plainText && message.plainText.length > 3) {
                                // Sometimes vscode just gives the absolute path or file:// uri in plain text
                                targetFsPath = message.plainText.startsWith('file://') ? vscode.Uri.parse(message.plainText).fsPath : message.plainText;
                            }

                            // Trim any accidental quotes on windows paths
                            if (targetFsPath.startsWith('"') && targetFsPath.endsWith('"')) {
                                targetFsPath = targetFsPath.slice(1, -1);
                            }

                            if (!targetFsPath || !fs.existsSync(targetFsPath)) {
                                vscode.window.showErrorMessage(`Drop failed. VS Code did not provide a valid file path. Path extracted: "${targetFsPath}" from Data: ${message.types}`);
                                return;
                            }

                            // Read the file and send back to WebView to perform the upload
                            const fileContent = fs.readFileSync(targetFsPath, 'utf8');
                            webviewView.webview.postMessage({
                                type: 'DO_FOCAS_UPLOAD',
                                pathId: message.pathId,
                                content: fileContent
                            });

                        } catch(err) {
                            vscode.window.showErrorMessage(`Failed to read dropped file: ${err}`);
                        }
                        break;
                }
            },
            undefined
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview, distPath: vscode.Uri): string {
        const indexHtmlPath = vscode.Uri.joinPath(distPath, 'index.html');
        
        let htmlContent = '<!DOCTYPE html><html lang="en"><body><h1>UI Not Found</h1><p>Ensure the frontend has been built to /dist/.</p></body></html>';
        try {
            if (fs.existsSync(indexHtmlPath.fsPath)) {
                let rawHtml = fs.readFileSync(indexHtmlPath.fsPath, 'utf8');
                const basePathUri = webview.asWebviewUri(distPath);
                
                // Replace Vite asset references
                htmlContent = rawHtml.replace(/(href|src)="\/([^"]*)"/g, (match, attr, filePath) => {
                    return `${attr}="${basePathUri.toString()}/${filePath}"`;
                });

                const config = vscode.workspace.getConfiguration('ncEdit7.focas');
                const defaultIp = config.get<string>('defaultIpAddress') || '192.168.1.1';

                // Inject our configuration
                const scriptInjection = `
                <script>
                    window.backendPort = ${this._backendPort};
                    window.focasDefaultIp = "${defaultIp}";
                    window.vscode = acquireVsCodeApi();
                    window.isFocasPanel = true; // Tell the app we are in the panel
                </script>
                <style>
                    /* Force the app container to hold only the FOCAS component tightly */
                    #app { overflow: hidden; background: var(--vscode-editor-background); }
                    #app-root { height: 100%; width: 100%; display: flex; flex-direction: column; }
                    nc-focas-transfer { flex: 1; height: 100%; width: 100%; }
                </style>
                `;
                htmlContent = htmlContent.replace('<head>', '<head>' + scriptInjection);
            }
        } catch (e) {
            return `<!DOCTYPE html><html><body>Error loading UI: ${e}</body></html>`;
        }

        return htmlContent;
    }
}
