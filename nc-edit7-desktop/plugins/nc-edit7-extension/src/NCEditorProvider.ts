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
					retainContextWhenHidden: true, // Keep the Webview alive when switching tabs
				}
			}
		);
		return providerRegistration;
	}

	private static readonly viewType = 'ncEdit7.editor';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {

		// Setup Webview options
		webviewPanel.webview.options = {
			enableScripts: true,
			// Allow access to the extension's root to load Vite's compiled dist
			localResourceRoots: [
				vscode.Uri.file(path.join(this.context.extensionPath, '..', 'dist')),
				vscode.Uri.file(path.join(this.context.extensionPath, '..', 'public'))
			]
		};

		// 1. Generate HTML pointing to the built web UI
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		// 2. Hook up event listener for Document -> Webview
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				this.updateWebview(webviewPanel, document);
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// 3. Hook up event listener for Webview -> Document
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'ready':
					// The webview has booted, send it the initial document text
					this.updateWebview(webviewPanel, document);
					return;
				case 'changed':
					// The frontend merged the 3 channels back to a string, apply the edit to the VS Code doc
					this.updateTextDocument(document, e.text);
					return;
			}
		});
	}

	/**
	 * Generates HTML to load the frontend from Vite's `dist/` directory.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Grab Vite's built app from the root project distribution folder
		const distPath = path.join(this.context.extensionPath, '..', 'dist');
		
		let htmlContent = '<!DOCTYPE html><html lang="en"><body><h1>UI Not Found</h1><p>Ensure the frontend has been built to /dist/.</p></body></html>';
		
		try {
			const indexHtmlPath = path.join(distPath, 'index.html');
			if (fs.existsSync(indexHtmlPath)) {
				let rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');

				// Fix paths in Vite's index.html from `/assets/xxx` to the Webview URI scheme
				const basePathUri = webview.asWebviewUri(vscode.Uri.file(distPath));
				htmlContent = rawHtml.replace(/(href|src)="\/([^"]*)"/g, (match, attr, filePath) => {
					return `${attr}="${basePathUri.toString()}/${filePath}"`;
				});

				// Inject our VS Code messaging bridge script
				const scriptInjection = `
				<script>
					const vscode = acquireVsCodeApi();
					
					// Catch messages from extension
					window.addEventListener('message', event => {
						const message = event.data;
						if (message.type === 'FILE_OPENED') {
							// Push the event onto the internal EventBus logic or global window so NCEditor can react
							window.dispatchEvent(new CustomEvent('vscode:file-opened', { detail: message.text }));
						}
					});

					// Signal ready state
					window.addEventListener('DOMContentLoaded', () => {
						vscode.postMessage({ type: 'ready' });
					});
					
					// Listen for internal "file changed" from the frontend and push it to VS Code
					window.addEventListener('vscode:file-changed', event => {
						vscode.postMessage({ type: 'changed', text: event.detail });
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

	private updateWebview(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument) {
		webviewPanel.webview.postMessage({
			type: 'FILE_OPENED',
			text: document.getText(),
		});
	}

	private updateTextDocument(document: vscode.TextDocument, mergedText: string) {
		// Apply an edit backwards to the VS Code Document model, avoiding trigger loops
		if (document.getText() === mergedText) {
			return; 
		}

		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			mergedText
		);
		vscode.workspace.applyEdit(edit);
	}
}
