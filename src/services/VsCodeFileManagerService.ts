import { IFileManagerService } from './IFileManagerService';
import { FileManagerService } from './FileManagerService';
import { EventBus } from './EventBus';
import { StateService } from './StateService';
import { NCFile, NCProgram } from '../core/types';

/**
 * Clean Architecture Wrapper for VS Code environment.
 * It uses the internal FileManagerService for logic but overrides 
 * actions to sync with the VS Code extension host.
 */
export class VsCodeFileManagerService implements IFileManagerService {
    private baseManager: FileManagerService;

    private vsCodeFileId: string | null = null;
    private isInternalUpdate: boolean = false;

    private lastMergedText: string = "";

    constructor(
        eventBus: EventBus,
        stateService: StateService
    ) {
        // We reuse the existing logic to manage memory maps and parsing
        // Turn OFF local storage sync for FileManagerService since VS Code manages document lifecycle
        this.baseManager = new FileManagerService(eventBus, stateService, false);
        
        // Listen to VS Code
        window.addEventListener('vscode:file-opened', (event: any) => {
            if (this.isInternalUpdate) return;
            const text = event.detail;
            const normalizedText = text.replace(/\r\n/g, '\n').trimEnd();
            
            // Skip bouncing backwards if VS Code is just validating the very changes we just pushed to it
            if (this.lastMergedText && normalizedText === this.lastMergedText.replace(/\r\n/g, '\n').trimEnd()) {
                return;
            }
            
            // If we already have the IDE file opened, just update it in place instead of violently replacing the file.
            if (this.vsCodeFileId) {
                // Manually parse and update the active programs to prevent UI/Undo wiping
                // Use a non-destructive broadcast if needed
                // For safety vs complete file reset, if it's a completely external change (like an undo)
                // we unfortunately have to push the new text in. By mapping it directly to active channels
                // we avoid regenerating File/Program IDs.
                
                const activeFile = this.baseManager.getActiveFile();
                if (activeFile && activeFile.id === this.vsCodeFileId) {
                    let parsed: string[] = [];
                    // Detect if the incoming text has our custom split tokens
                    // Normalize CRLF to LF so we can reliably split the channels
                    const normalizedText = text.replace(/\r\n/g, '\n');
                    if (normalizedText.includes(';--- CHANNEL SPLIT ---')) {
                        parsed = normalizedText.split('\n;--- CHANNEL SPLIT ---\n');
                    } else {
                        parsed = (this.baseManager as any).parseNCCode(normalizedText, { parseMultiChannel: true });
                    }
                    
                    activeFile.content = normalizedText;
                    activeFile.channels = parsed;
                    
                    parsed.forEach((channelContent: string, index: number) => {
                        if (channelContent !== undefined && channelContent !== null) {
                            const channelId = (index + 1).toString();
                            const activeProgram = this.baseManager.getActiveProgram(channelId);
                            if (activeProgram) {
                                activeProgram.content = channelContent;
                                // Emit change without throwing away the program
                                eventBus.publish('program:content_changed', { channelId, program: activeProgram });
                            }
                        }
                    });
                    return;
                }
            }
            
            // First boot/file load
            this.openFile(text, "VSCode_File", { parseMultiChannel: true }).then(file => {
                this.vsCodeFileId = file.id;
            });
        });

        // Watch for internal saves/changes to broadcast back to VS Code
        // (Removed syncing on program:active_changed to prevent infinite dirty loops on file load)
        // You would also catch text changes from the code panes here to trigger syncToHost()
    }

    private syncToHost() {
        // Collect all 3 channels and merge them
        const programs = [
            this.getActiveProgram('1'),
            this.getActiveProgram('2'),
            this.getActiveProgram('3')
        ];

        const validPrograms = programs.map(p => p ? p.content : '');
        let mergedText = validPrograms[0];
        if (validPrograms[1] || validPrograms[2]) {
            mergedText += '\n;--- CHANNEL SPLIT ---\n' + validPrograms[1];
        }
        if (validPrograms[2]) {
            mergedText += '\n;--- CHANNEL SPLIT ---\n' + validPrograms[2];
        }

        this.lastMergedText = mergedText;
        window.dispatchEvent(new CustomEvent('vscode:file-changed', { detail: mergedText }));
    }

    // --- Pass-through to Core Logic ---
    getFiles(): NCFile[] { return this.baseManager.getFiles(); }
    getPrograms(channelId: string): NCProgram[] { return this.baseManager.getPrograms(channelId); }
    getActiveProgram(channelId: string): NCProgram | null { return this.baseManager.getActiveProgram(channelId); }
    
    updateActiveProgramContent(channelId: string, content: string): void {
        this.baseManager.updateActiveProgramContent(channelId, content);
        this.isInternalUpdate = true;
        this.syncToHost();
        setTimeout(() => this.isInternalUpdate = false, 50);
    }
    
    setActiveProgram(channelId: string, programId: string): void { this.baseManager.setActiveProgram(channelId, programId); }
    closeProgram(programId: string): void { this.baseManager.closeProgram(programId); }
    getActiveFile(): NCFile | null { return this.baseManager.getActiveFile(); }
    
    async openFile(content: string, name: string, options: { parseMultiChannel: boolean; channel?: number | undefined; }): Promise<NCFile> {
        return this.baseManager.openFile(content, name, options);
    }
    
    newFile(name?: string | undefined): void { this.baseManager.newFile(name); }
    newProgram(channelId: string, name?: string | undefined): void { this.baseManager.newProgram(channelId, name); }
    selectFile(id: string): void { this.baseManager.selectFile(id); }
    closeFile(id: string): void { this.baseManager.closeFile(id); }
    renameFile(id: string, newName: string): void { this.baseManager.renameFile(id, newName); }
    renameProgram(id: string, newName: string): void { this.baseManager.renameProgram(id, newName); }
}

