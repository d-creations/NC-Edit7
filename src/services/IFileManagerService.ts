import { NCFile, NCProgram } from '../core/types';

export interface IFileManagerService {
  getFiles(): NCFile[];
  getPrograms(channelId: string): NCProgram[];
  getActiveProgram(channelId: string): NCProgram | null;
  updateActiveProgramContent(channelId: string, content: string): void;
  setActiveProgram(channelId: string, programId: string): void;
  closeProgram(programId: string): void;
  
  getActiveFile(): NCFile | null;
  openFile(content: string, name: string, options: { parseMultiChannel: boolean, channel?: number }): Promise<NCFile>;
  newFile(name?: string): void;
  newProgram(channelId: string, name?: string): void;
  selectFile(id: string): void;
  closeFile(id: string): void;
  renameFile(id: string, newName: string): void;
  renameProgram(id: string, newName: string): void;
}
