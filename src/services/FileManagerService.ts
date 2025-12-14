import { EventBus } from './EventBus';
import { NCFile, NCProgram } from '../core/types';

export class FileManagerService {
  private files: NCFile[] = [];
  private programs: NCProgram[] = [];
  private activeProgramIds: Map<string, string> = new Map(); // channelId -> programId
  private activeFileId: string | null = null;

  constructor(private eventBus: EventBus) {
    this.loadFromStorage();
  }

  public getFiles(): NCFile[] {
    return this.files;
  }

  public getPrograms(channelId: string): NCProgram[] {
    return this.programs.filter(p => p.channelId === channelId);
  }

  public getActiveProgram(channelId: string): NCProgram | null {
    const id = this.activeProgramIds.get(channelId);
    return id ? this.programs.find(p => p.id === id) || null : null;
  }

  public setActiveProgram(channelId: string, programId: string) {
    const program = this.programs.find(p => p.id === programId && p.channelId === channelId);
    if (program) {
        this.activeProgramIds.set(channelId, programId);
        this.eventBus.publish('program:active_changed', { channelId, program });
        this.saveToStorage();
    }
  }

  public closeProgram(programId: string) {
    const program = this.programs.find(p => p.id === programId);
    if (!program) return;

    this.programs = this.programs.filter(p => p.id !== programId);
    
    // If it was active, unset it
    if (this.activeProgramIds.get(program.channelId) === programId) {
        const remaining = this.getPrograms(program.channelId);
        if (remaining.length > 0) {
            this.setActiveProgram(program.channelId, remaining[0].id);
        } else {
            this.activeProgramIds.delete(program.channelId);
            this.eventBus.publish('program:active_changed', { channelId: program.channelId, program: null });
        }
    }
    
    this.eventBus.publish('program:closed', { channelId: program.channelId, programId });
    this.saveToStorage();
  }

  public getActiveFile(): NCFile | null {
    return this.files.find(f => f.id === this.activeFileId) || null;
  }

  public async openFile(content: string, name: string, options: { parseMultiChannel: boolean, channel?: number }): Promise<NCFile> {
    const parsed = this.parseNCCode(content, options);
    const file: NCFile = {
      id: this.generateId(),
      name: name,
      content: content,
      channels: parsed,
      isMultiChannel: parsed.length > 1,
      lastModified: Date.now()
    };
    
    this.files.push(file);
    this.activeFileId = file.id;

    // Create programs from the file
    parsed.forEach((channelContent, index) => {
        if (channelContent) {
            const channelId = (index + 1).toString();
            const program: NCProgram = {
                id: this.generateId(),
                name: file.isMultiChannel ? `${name} (CH${channelId})` : name,
                content: channelContent,
                channelId: channelId,
                sourceFileId: file.id,
                lastModified: Date.now()
            };
            this.programs.push(program);
            // Automatically activate the new program for this channel
            this.setActiveProgram(channelId, program.id);
        }
    });

    this.saveToStorage();
    this.eventBus.publish('file:opened', file);
    this.eventBus.publish('file:active_changed', file);
    return file;
  }

  public selectFile(id: string) {
    const file = this.files.find(f => f.id === id);
    if (file) {
      this.activeFileId = id;
      this.eventBus.publish('file:active_changed', file);
    }
  }

  public closeFile(id: string) {
    this.files = this.files.filter(f => f.id !== id);
    // Also close associated programs? 
    // Maybe keep them if we treat "File Manager" as a "Project Explorer" and "Programs" as "Loaded in Memory"
    // For now, let's remove them to keep it simple
    const programsToRemove = this.programs.filter(p => p.sourceFileId === id);
    programsToRemove.forEach(p => this.closeProgram(p.id));

    if (this.activeFileId === id) {
      this.activeFileId = this.files.length > 0 ? this.files[0].id : null;
      this.eventBus.publish('file:active_changed', this.getActiveFile());
    }
    this.saveToStorage();
    this.eventBus.publish('file:closed', id);
  }

  private parseNCCode(content: string, options: { parseMultiChannel: boolean, channel?: number }): string[] {
    let result = content;
    let isMultiProgram = false;
    
    if (options.parseMultiChannel) {
        isMultiProgram = result.includes("<");
    }

    if (isMultiProgram) {
        result = result.replace(/&F=.*/g, "");
        result = result.replace(/%/g, "");
        let ret: string[] = [];
        let programs = result.split("<");
        // If the first part is empty (file starts with <), remove it
        if (programs[0].trim() === "") {
            programs.shift();
        }

        for (let i = 0; i < programs.length; i++) {
            if (i > 2) break;
            
            let programLines = programs[i].split("\n");
            let header = programLines[0];
            
            let endNameIndex = header.indexOf(".");
            if (endNameIndex === -1) {
                endNameIndex = header.length - 1;
            }
            
            let programNameS = header.substring(0, endNameIndex).replace("<", "");
            programNameS = programNameS.replace(/\..*\./, "");
            
            // User logic: ret.push(programNameS + programs[programNr].replace(/.*>/, ""));
            // Note: programs[i] still contains the header line if we didn't strip it.
            // The user's regex replace(/.*>/, "") seems to intend to remove the header tag?
            // But split("<") removes the separator.
            // If the file is `<HEAD>...`, split gives `HEAD>...`.
            // So `replace(/.*>/, "")` removes `HEAD>`.
            
            let contentBody = programs[i].replace(/.*>/, "");
            ret.push(programNameS + contentBody);
        }
        return ret;
    } else if (options.channel === 2) {
        return ["", result];
    } else if (options.channel === 3) {
        return ["", "", result];
    } else {
        return [result];
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private saveToStorage() {
    try {
        localStorage.setItem('nc-files', JSON.stringify(this.files));
        localStorage.setItem('nc-programs', JSON.stringify(this.programs));
        localStorage.setItem('nc-active-programs', JSON.stringify(Array.from(this.activeProgramIds.entries())));
    } catch (e) {
        console.error("Failed to save files to localStorage", e);
    }
  }

  private loadFromStorage() {
    try {
        const storedFiles = localStorage.getItem('nc-files');
        if (storedFiles) {
            this.files = JSON.parse(storedFiles);
            if (this.files.length > 0) {
                this.activeFileId = this.files[0].id;
            }
        }

        const storedPrograms = localStorage.getItem('nc-programs');
        if (storedPrograms) {
            this.programs = JSON.parse(storedPrograms);
        }

        const storedActive = localStorage.getItem('nc-active-programs');
        if (storedActive) {
            this.activeProgramIds = new Map(JSON.parse(storedActive));
        }
    } catch (e) {
        console.error("Failed to load files", e);
    }
  }
}
