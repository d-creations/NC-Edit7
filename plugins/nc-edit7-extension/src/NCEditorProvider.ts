import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

type WorkbenchTab = 'variables' | 'errors' | 'focas';

type EditorRelayMessage =
    | { type: 'FILES_OPENED'; isSingleFile: boolean; activeChannel: string; channels: Record<string, string> }
    | { type: 'FILE_UPDATED_EXTERNALLY'; channels: Record<string, string> }
    | { type: 'FILE_UPDATED_EXTERNALLY'; channel: string; text: string; activeChannel?: string }
    | { type: 'OPEN_WORKBENCH_PANEL'; tab?: WorkbenchTab }
    | { type: 'WORKBENCH_BRIDGE'; eventType: 'EXECUTION_COMPLETED'; payload: { channelId: string; result: { variableSnapshotEntries: Array<[number, number]>; errors: unknown[] } } }
    | { type: 'WORKBENCH_BRIDGE'; eventType: 'EXECUTION_ERROR'; payload: { channelId: string; error: { message: string } } }
    | { type: 'WORKBENCH_BRIDGE'; eventType: 'PLOT_CLEARED'; payload: Record<string, never> };

export class NCEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext, backendPort: number): vscode.Disposable {
		const provider = new NCEditorProvider(context, backendPort);
		const providerRegistration = vscode.window.registerCustomEditorProvider(
			NCEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true
				}
			}
		);
		return providerRegistration;
	}

	public static readonly viewType = 'ncEdit7.editor';
    private readonly webviewPanels = new Set<vscode.WebviewPanel>();
    private activeWebviewPanel?: vscode.WebviewPanel;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly backendPort: number,
        private readonly relayToWorkbenchPanel?: (message: EditorRelayMessage) => void,
    ) { }

    private isUpdatingDocument = false;

    private analyzeUri(uri: vscode.Uri) {
        const ext = path.extname(uri.fsPath).toLowerCase();
        let isSingleFile = false;
        let activeChannel = '1';
        
        if (ext === '.pa') {
            isSingleFile = true;
        } else if (['.p1', '.m'].includes(ext)) {
            activeChannel = '1';
        } else if (['.p2', '.s', '.p-2'].includes(ext)) {
            activeChannel = '2';
        } else if (ext === '.p3') {
            activeChannel = '3';
        }
        
        const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
        return { isSingleFile, activeChannel, baseName, ext };
    }

    private parsePAFile(content: string) {
        const channels = new Map<string, string>();
        const regex = /(<O[A-Za-z0-9_]+\.P[1-3]>)/g;
        const parts = content.split(regex);
        
        const header = parts[0] || '';
        
        for (let i = 1; i < parts.length; i += 2) {
            const marker = parts[i];
            const text = parts[i+1] || '';
            const chMatch = marker.match(/\.P([1-3])>/);
            if (chMatch) {
                channels.set(chMatch[1], marker + text);
            }
        }
        
        if (channels.size === 0) channels.set('1', content);
        return { header, channels };
    }

    private assemblePAFile(header: string, channels: Map<string, string>) {
        let res = header.trimEnd() + '\n';
        for (let i = 1; i <= 3; i++) {
            const ch = i.toString();
            if (channels.has(ch)) {
                res += channels.get(ch)?.trimEnd() + '\n\n';
            }
        }
        return res.trim() + '\n';
    }

    private async discoverSiblings(baseUri: vscode.Uri, baseName: string, activeChannel: string, channelDocs: Map<string, vscode.TextDocument>) {
        const dir = vscode.Uri.joinPath(baseUri, '..');
        const extMap: Record<string, string[]> = {
            '1': ['.p1', '.m', '.P1', '.M'],
            '2': ['.p2', '.s', '.p-2', '.P2', '.S', '.P-2'],
            '3': ['.p3', '.P3']
        };
        
        for (const ch of ['1', '2', '3']) {
            if (ch === activeChannel) continue;
            
            for (const ext of extMap[ch]) {
                try {
                    const targetUri = vscode.Uri.joinPath(dir, baseName + ext);
                    const stat = await vscode.workspace.fs.stat(targetUri);
                    if (stat) {
                        const doc = await vscode.workspace.openTextDocument(targetUri);
                        channelDocs.set(ch, doc);
                        break;
                    }
                } catch (e) {
                    // Ignore missing files
                }
            }
        }
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.webviewPanels.add(webviewPanel);
        this.activeWebviewPanel = webviewPanel;

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'bundle', 'dist'))
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        const { isSingleFile, activeChannel, baseName } = this.analyzeUri(document.uri);
        const channelDocs = new Map<string, vscode.TextDocument>();
        let paChannelsContent = new Map<string, string>();
        let paHeaderContent = '';

        const loadChannels = async () => {
            if (isSingleFile) {
                const parsed = this.parsePAFile(document.getText());
                paChannelsContent = parsed.channels;
                paHeaderContent = parsed.header;
                return Object.fromEntries(paChannelsContent);
            } else {
                channelDocs.set(activeChannel, document);
                await this.discoverSiblings(document.uri, baseName, activeChannel, channelDocs);
                const channelsObj: Record<string, string> = {};
                for (const [ch, doc] of channelDocs.entries()) {
                    channelsObj[ch] = doc.getText();
                }
                return channelsObj;
            }
        };

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (this.isUpdatingDocument) return;

            if (isSingleFile) {
                if (e.document.uri.toString() === document.uri.toString()) {
                    const parsed = this.parsePAFile(document.getText());
                    const message: EditorRelayMessage = {
                        type: 'FILE_UPDATED_EXTERNALLY',
                        channels: Object.fromEntries(parsed.channels)
                    };
                    paChannelsContent = parsed.channels;
                    webviewPanel.webview.postMessage(message);
                    this.relayMessageToWorkbench(webviewPanel, message);
                }
            } else {
                for (const [ch, doc] of channelDocs.entries()) {
                    if (e.document.uri.toString() === doc.uri.toString()) {
                        const message: EditorRelayMessage = {
                            type: 'FILE_UPDATED_EXTERNALLY',
                            channel: ch,
                            text: doc.getText()
                        };
                        webviewPanel.webview.postMessage(message);
                        this.relayMessageToWorkbench(webviewPanel, message);
                    }
                }
            }
        });

        webviewPanel.onDidChangeViewState(({ webviewPanel: panel }) => {
            if (panel.active) {
                this.activeWebviewPanel = panel;
            }
        });

        webviewPanel.onDidDispose(() => {
            this.webviewPanels.delete(webviewPanel);
            if (this.activeWebviewPanel === webviewPanel) {
                this.activeWebviewPanel = Array.from(this.webviewPanels.values())[0];
            }
            changeDocumentSubscription.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage(async e => {
            switch (e.type) {
                case 'ready':
                    const channelsData = await loadChannels();
                    const readyMessage: EditorRelayMessage = {
                        type: 'FILES_OPENED',
                        isSingleFile,
                        activeChannel,
                        channels: channelsData
                    };
                    webviewPanel.webview.postMessage(readyMessage);
                    this.relayMessageToWorkbench(webviewPanel, readyMessage);
                    return;
                case 'changed':
                    if (isSingleFile) {
                        paChannelsContent.set(e.channel, e.text);
                        const assembled = this.assemblePAFile(paHeaderContent, paChannelsContent);
                        await this.updateTextDocument(document, assembled);
                    } else {
                        const targetDoc = channelDocs.get(e.channel);
                        if (targetDoc) {
                            await this.updateTextDocument(targetDoc, e.text);
                        }
                    }

                    this.relayMessageToWorkbench(webviewPanel, {
                        type: 'FILE_UPDATED_EXTERNALLY',
                        channel: e.channel,
                        text: e.text,
                        activeChannel: e.channel,
                    });
                    return;
                case 'workbench:relay':
                    this.relayMessageToWorkbench(webviewPanel, e.message as EditorRelayMessage);
                    return;
                case 'workbench:open-panel':
                    this.relayMessageToWorkbench(webviewPanel, {
                        type: 'OPEN_WORKBENCH_PANEL',
                        tab: e.tab as WorkbenchTab | undefined,
                    });
                    return;
            }
        });
    }

    public updateConfig(config: Record<string, unknown>): void {
        this.webviewPanels.forEach((panel) => {
            panel.webview.postMessage({ type: 'UPDATE_CONFIG', config });
        });
    }

    private relayMessageToWorkbench(sourcePanel: vscode.WebviewPanel, message: EditorRelayMessage): void {
        if (this.activeWebviewPanel && this.activeWebviewPanel !== sourcePanel && !sourcePanel.active) {
            return;
        }

        this.activeWebviewPanel = sourcePanel;
        this.relayToWorkbenchPanel?.(message);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const distPath = path.join(this.context.extensionPath, 'bundle', 'dist');

        let htmlContent = '<!DOCTYPE html><html lang="en"><body><h1>UI Not Found</h1><p>Ensure the frontend has been bundled successfully.</p></body></html>';
        const indexHtmlPath = path.join(distPath, 'index.html');
        try {
            if (fs.existsSync(indexHtmlPath)) {
                let rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                const basePathUri = webview.asWebviewUri(vscode.Uri.file(distPath));
                htmlContent = rawHtml.replace(/(href|src)="\/([^"]*)"/g, (match, attr, filePath) => {
                    return `${attr}="${basePathUri.toString()}/${filePath}"`;
                });

                const focasConfig = vscode.workspace.getConfiguration('ncEdit7.focas');
                const layoutConfig = vscode.workspace.getConfiguration('ncEdit7.layout');
                const defaultIp = focasConfig.get<string>('defaultIpAddress') || '192.168.1.1';
                const themeMode = vscode.workspace.getConfiguration('ncEdit7').get<string>('theme.mode') || 'vscode';
                const focasPlacement = layoutConfig.get<string>('focasPlacement') || 'external-panel';

                const scriptInjection = `
                <script>
                    window.backendPort = ${this.backendPort};
                    window.focasDefaultIp = "${defaultIp}";
                    window.vscodeConfig = {
                        backendPort: ${this.backendPort},
                        focasDefaultIp: "${defaultIp}",
                        themeMode: "${themeMode}",
                        hostMode: "vscode-editor",
                        focasPlacement: "${focasPlacement}"
                    };
                    window.vscodeApi = window.vscodeApi || acquireVsCodeApi();
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'FILES_OPENED' || message.type === 'FILE_UPDATED_EXTERNALLY') {
                            window.dispatchEvent(new CustomEvent('vscode:files-opened', { detail: message }));
                        }
                    });
                    window.addEventListener('DOMContentLoaded', () => {
                        window.vscodeApi.postMessage({ type: 'ready' });
                    });
                    window.addEventListener('vscode:file-changed', event => {
                        window.vscodeApi.postMessage({ type: 'changed', channel: event.detail.channel, text: event.detail.text });
                    });
                </script>
                `;
                htmlContent = htmlContent.replace('</head>', `${scriptInjection}</head>`);
            }
        } catch (error) {
            console.error('Failed to load Vite index.html', error);
        }
        return htmlContent;
    }

    private async updateTextDocument(document: vscode.TextDocument, newText: string) {
        const currentText = document.getText().replace(/\r\n/g, '\n').trimEnd();
        const formattedNewText = newText.replace(/\r\n/g, '\n').trimEnd();
        if (currentText === formattedNewText) return;
        
        this.isUpdatingDocument = true;
        const edit = new vscode.WorkspaceEdit();
        const lastLine = document.lineAt(document.lineCount - 1);
        const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
        edit.replace(document.uri, fullRange, newText);
        await vscode.workspace.applyEdit(edit);
        this.isUpdatingDocument = false;
    }
}


