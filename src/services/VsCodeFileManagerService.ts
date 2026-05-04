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

    constructor(
        eventBus: EventBus,
        stateService: StateService
    ) {
        // We reuse the existing logic to manage memory maps and parsing
        this.baseManager = new FileManagerService(eventBus, stateService);
        
        // Listen to VS Code
        window.addEventListener('vscode:file-opened', (event: any) => {
            const text = event.detail;
            this.openFile(text, "VSCode_File", { parseMultiChannel: true });
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

        window.dispatchEvent(new CustomEvent('vscode:file-changed', { detail: mergedText }));
    }

    // --- Pass-through to Core Logic ---
    getFiles(): NCFile[] { return this.baseManager.getFiles(); }
    getPrograms(channelId: string): NCProgram[] { return this.baseManager.getPrograms(channelId); }
    getActiveProgram(channelId: string): NCProgram | null { return this.baseManager.getActiveProgram(channelId); }
    
    updateActiveProgramContent(channelId: string, content: string): void {
        this.baseManager.updateActiveProgramContent(channelId, content);
        this.syncToHost();
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

