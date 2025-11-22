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
        }
        .channel-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .channel-sidebar {
          width: 200px;
          border-right: 1px solid #3e3e42;
          display: flex;
          flex-direction: column;
        }
        .channel-editor-area {
          flex: 1;
          position: relative;
        }
        .channel-tools-panel {
          height: 150px;
          border-top: 1px solid #3e3e42;
        }
      </style>
      <div class="channel-header">
        <span>Channel ${this.channelId}</span>
        <div class="controls">
          <!-- TODO: Add channel controls -->
        </div>
      </div>
      <div class="channel-content">
        <div class="channel-sidebar">
          <nc-keyword-panel channel-id="${this.channelId}" style="flex: 1;"></nc-keyword-panel>
          <div class="channel-tools-panel">
            <nc-tool-list></nc-tool-list>
          </div>
        </div>
        <div class="channel-editor-area">
          <nc-code-pane channel-id="${this.channelId}"></nc-code-pane>
        </div>
      </div>
    `;
  }
}

customElements.define('nc-channel-pane', NCChannelPane);
