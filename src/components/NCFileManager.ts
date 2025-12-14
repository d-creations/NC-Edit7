import { ServiceRegistry } from '@core/ServiceRegistry';
import { FILE_MANAGER_SERVICE_TOKEN, EVENT_BUS_TOKEN } from '@core/ServiceTokens';
import { FileManagerService } from '@services/FileManagerService';
import { EventBus } from '@services/EventBus';
import { NCFile } from '@core/types';

export class NCFileManager extends HTMLElement {
  private fileManager: FileManagerService;
  private eventBus: EventBus;
  private files: NCFile[] = [];
  private activeFileId: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const registry = ServiceRegistry.getInstance();
    this.fileManager = registry.get(FILE_MANAGER_SERVICE_TOKEN);
    this.eventBus = registry.get(EVENT_BUS_TOKEN);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.refreshFiles();
    
    this.eventBus.subscribe('file:opened', () => this.refreshFiles());
    this.eventBus.subscribe('file:closed', () => this.refreshFiles());
    this.eventBus.subscribe('file:active_changed', () => this.refreshFiles());
  }

  private refreshFiles() {
    this.files = this.fileManager.getFiles();
    const active = this.fileManager.getActiveFile();
    this.activeFileId = active ? active.id : null;
    this.updateFileList();
  }

  private updateFileList() {
    const list = this.shadowRoot?.getElementById('file-list');
    if (!list) return;

    list.innerHTML = '';
    this.files.forEach(file => {
        const item = document.createElement('div');
        item.className = `file-item ${file.id === this.activeFileId ? 'active' : ''}`;
        item.textContent = file.name;
        item.onclick = () => this.fileManager.selectFile(file.id);
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.fileManager.closeFile(file.id);
        };
        
        item.appendChild(closeBtn);
        list.appendChild(item);
    });
  }

  private setupEventListeners() {
    const openBtn = this.shadowRoot?.getElementById('open-btn');
    const fileInput = this.shadowRoot?.getElementById('file-input') as HTMLInputElement;
    const multiCheck = this.shadowRoot?.getElementById('multi-channel-check') as HTMLInputElement;
    const channelSelect = this.shadowRoot?.getElementById('channel-select') as HTMLSelectElement;

    openBtn?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
            const file = files[0];
            const text = await file.text();
            
            const isMulti = multiCheck.checked;
            const channel = parseInt(channelSelect.value);
            
            await this.fileManager.openFile(text, file.name, {
                parseMultiChannel: isMulti,
                channel: channel
            });
            
            fileInput.value = ''; // Reset
        }
    });
  }

  private render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: #252526;
          color: #cccccc;
          padding: 5px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 5px;
        }
        .file-list {
            display: flex;
            gap: 5px;
            overflow-x: auto;
        }
        .file-item {
            padding: 5px 10px;
            background: #333333;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            border-radius: 3px;
            white-space: nowrap;
        }
        .file-item.active {
            background: #007acc;
            color: white;
        }
        .file-item:hover {
            background: #444444;
        }
        .file-item.active:hover {
            background: #0062a3;
        }
        .close-btn {
            font-weight: bold;
            font-size: 14px;
            opacity: 0.7;
        }
        .close-btn:hover {
            opacity: 1;
        }
        button {
            background: #0e639c;
            color: white;
            border: none;
            padding: 4px 8px;
            cursor: pointer;
        }
        select, input[type="checkbox"] {
            background: #3c3c3c;
            color: white;
            border: 1px solid #3e3e42;
        }
      </style>
      <div class="file-manager">
        <div class="toolbar">
          <button id="open-btn">Open File</button>
          <input type="file" id="file-input" style="display: none;" />
          <div class="options">
              <label><input type="checkbox" id="multi-channel-check"> Multi-Channel</label>
              <select id="channel-select">
                  <option value="1">Channel 1</option>
                  <option value="2">Channel 2</option>
                  <option value="3">Channel 3</option>
              </select>
          </div>
        </div>
        <div class="file-list" id="file-list"></div>
      </div>
    `;
  }
}

customElements.define('nc-file-manager', NCFileManager);
