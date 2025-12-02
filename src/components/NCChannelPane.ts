import './NCCodePane';
import './NCKeywordPanel';
import './NCVariableList';
import './NCToolList';
import './NCExecutedList';

export class NCChannelPane extends HTMLElement {
  private channelId: string = '';

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
      this.render();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Forward keyword-click events to the code pane
    this.addEventListener('keyword-click', ((e: CustomEvent) => {
      const codePaneElement = this.querySelector('nc-code-pane');
      if (codePaneElement) {
        codePaneElement.dispatchEvent(
          new CustomEvent('keyword-click', {
            detail: e.detail,
            bubbles: false,
          }),
        );
      }
    }) as EventListener);
  }

  private render() {
    this.innerHTML = `
      <style>
        nc-channel-pane {
          display: flex;
          flex: 1;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          border: 1px solid #3e3e42;
        }
        .channel-header {
          padding: 8px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .channel-controls {
          display: flex;
          gap: 4px;
        }
        .channel-button {
          padding: 2px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        }
        .channel-button:hover {
          background: #4c4c4c;
        }
        .channel-button.active {
          background: #0e639c;
          color: #fff;
        }
        .channel-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .channel-sidebar {
          width: auto;
          min-width: 100px;
          max-width: 180px;
          border-right: 1px solid #3e3e42;
          display: flex;
          flex-direction: column;
        }
        .channel-editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .channel-editor-wrapper {
          flex: 1;
          overflow: hidden;
        }
        .channel-tools-panel {
          height: 150px;
          border-top: 1px solid #3e3e42;
        }
      </style>
      <div class="channel-header">
        <span>Channel ${this.channelId}</span>
        <div class="channel-controls">
        </div>
      </div>
      <div class="channel-content">
        <div class="channel-sidebar">
          <nc-keyword-panel channel-id="${this.channelId}" style="flex: 1;"></nc-keyword-panel>
          <div class="channel-tools-panel">
            <nc-tool-list channel-id="${this.channelId}"></nc-tool-list>
          </div>
        </div>
        <div class="channel-editor-area">
          <div class="channel-editor-wrapper">
            <nc-code-pane channel-id="${this.channelId}"></nc-code-pane>
          </div>
          <nc-variable-list channel-id="${this.channelId}" id="variable-drawer"></nc-variable-list>
        </div>
      </div>
    `;

    // variable drawer is self-contained (toggle/resize handled inside component)
  }
}

customElements.define('nc-channel-pane', NCChannelPane);
