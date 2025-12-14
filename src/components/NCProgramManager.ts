import { ServiceRegistry } from '@core/ServiceRegistry';
import { FILE_MANAGER_SERVICE_TOKEN, EVENT_BUS_TOKEN } from '@core/ServiceTokens';
import { FileManagerService } from '@services/FileManagerService';
import { EventBus } from '@services/EventBus';
import { NCProgram } from '@core/types';

export class NCProgramManager extends HTMLElement {
  private fileManager: FileManagerService;
  private eventBus: EventBus;
  private channelId: string = '';
  private programs: NCProgram[] = [];
  private activeProgramId: string | null = null;

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const registry = ServiceRegistry.getInstance();
    this.fileManager = registry.get(FILE_MANAGER_SERVICE_TOKEN);
    this.eventBus = registry.get(EVENT_BUS_TOKEN);
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
      this.refreshPrograms();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.refreshPrograms();
    
    this.eventBus.subscribe('program:active_changed', (data: { channelId: string, program: NCProgram | null }) => {
        if (data.channelId === this.channelId) {
            this.activeProgramId = data.program ? data.program.id : null;
            this.updateProgramList();
        }
    });
    
    this.eventBus.subscribe('file:opened', () => this.refreshPrograms());
    this.eventBus.subscribe('program:closed', (data: { channelId: string, programId: string }) => {
        if (data.channelId === this.channelId) {
            this.refreshPrograms();
        }
    });
  }

  private refreshPrograms() {
    if (!this.channelId) return;
    this.programs = this.fileManager.getPrograms(this.channelId);
    const active = this.fileManager.getActiveProgram(this.channelId);
    this.activeProgramId = active ? active.id : null;
    this.updateProgramList();
  }

  private updateProgramList() {
    const list = this.shadowRoot?.getElementById('program-list');
    if (!list) return;

    list.innerHTML = '';
    
    if (this.programs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No programs loaded';
        list.appendChild(empty);
        return;
    }

    this.programs.forEach(prog => {
        const item = document.createElement('div');
        item.className = `program-item ${prog.id === this.activeProgramId ? 'active' : ''}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'program-name';
        nameSpan.textContent = prog.name;
        nameSpan.onclick = () => this.fileManager.setActiveProgram(this.channelId, prog.id);
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close Program';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.fileManager.closeProgram(prog.id);
        };
        
        item.appendChild(nameSpan);
        item.appendChild(closeBtn);
        list.appendChild(item);
    });
  }

  private setupEventListeners() {
    // Event listeners are now attached to elements in updateProgramList
  }

  private render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #252526;
          overflow: hidden;
        }
        .header {
            padding: 8px;
            background: #333333;
            font-weight: bold;
            font-size: 12px;
            border-bottom: 1px solid #3e3e42;
        }
        .program-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px;
        }
        .program-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            margin-bottom: 2px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            color: #cccccc;
        }
        .program-item:hover {
            background: #2a2d2e;
        }
        .program-item.active {
            background: #094771;
            color: white;
        }
        .program-item.active:hover {
            background: #094771;
        }
        .program-name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .close-btn {
            padding: 2px 6px;
            margin-left: 8px;
            opacity: 0.6;
            font-weight: bold;
        }
        .close-btn:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
        .empty-message {
            padding: 10px;
            text-align: center;
            color: #888;
            font-style: italic;
            font-size: 12px;
        }
      </style>
      <div class="header">Loaded Programs</div>
      <div class="program-list" id="program-list"></div>
    `;
  }
}

customElements.define('nc-program-manager', NCProgramManager);
