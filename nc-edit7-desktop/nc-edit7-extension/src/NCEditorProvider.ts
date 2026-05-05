import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class NCEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new NCEditorProvider(context);
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

	private static readonly viewType = 'ncEdit7.editor';
    constructor(private readonly context: vscode.ExtensionContext) { }

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

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, '..', '..', 'dist')),
                vscode.Uri.file(path.join(this.context.extensionPath, '..', 'dist')),
                vscode.Uri.file(path.join(this.context.extensionPath, '..', '..', 'public')),
                vscode.Uri.file(path.join(this.context.extensionPath, '..', 'public'))
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
                    paChannelsContent = parsed.channels;
                    webviewPanel.webview.postMessage({
                        type: 'FILE_UPDATED_EXTERNALLY',
                        channels: Object.fromEntries(paChannelsContent)
                    });
                }
            } else {
                for (const [ch, doc] of channelDocs.entries()) {
                    if (e.document.uri.toString() === doc.uri.toString()) {
                        webviewPanel.webview.postMessage({
                            type: 'FILE_UPDATED_EXTERNALLY',
                            channel: ch,
                            text: doc.getText()
                        });
                    }
                }
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage(async e => {
            switch (e.type) {
                case 'ready':
                    const channelsData = await loadChannels();
                    webviewPanel.webview.postMessage({
                        type: 'FILES_OPENED',
                        isSingleFile,
                        activeChannel,
                        channels: channelsData
                    });
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
                    return;
            }
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const distPathOptions = [
            path.join(this.context.extensionPath, '..', '..', 'dist'),
            path.join(this.context.extensionPath, '..', 'dist')
        ];
        let distPath = distPathOptions.find(p => fs.existsSync(p)) || distPathOptions[0];

        let htmlContent = '<!DOCTYPE html><html lang="en"><body><h1>UI Not Found</h1><p>Ensure the frontend has been built to /dist/.</p></body></html>';
        const indexHtmlPath = path.join(distPath, 'index.html');
        try {
            if (fs.existsSync(indexHtmlPath)) {
                let rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                const basePathUri = webview.asWebviewUri(vscode.Uri.file(distPath));
                htmlContent = rawHtml.replace(/(href|src)="\/([^"]*)"/g, (match, attr, filePath) => {
                    return `${attr}="${basePathUri.toString()}/${filePath}"`;
                });

                const scriptInjection = `
                <script>
                    const vscode = acquireVsCodeApi();
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'FILES_OPENED' || message.type === 'FILE_UPDATED_EXTERNALLY') {
                            window.dispatchEvent(new CustomEvent('vscode:files-opened', { detail: message }));
                        }
                    });
                    window.addEventListener('DOMContentLoaded', () => {
                        vscode.postMessage({ type: 'ready' });
                    });
                    window.addEventListener('vscode:file-changed', event => {
                        vscode.postMessage({ type: 'changed', channel: event.detail.channel, text: event.detail.text });
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


