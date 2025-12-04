import './NCVariableList';
import './NCErrorList';
import type { CustomVariable } from '@core/types';
import type { NCVariableList } from './NCVariableList';

export class NCBottomPanel extends HTMLElement {
  private channelId: string = '';
  private isOpen = false;
  private lastHeight = 280;
  private minHeight = 120;

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getCustomVariables(): CustomVariable[] {
    const variableList = this.shadowRoot?.querySelector(
      'nc-variable-list',
    ) as NCVariableList | null;
    return variableList ? variableList.getCustomVariables() : [];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
      this.updateChildren();
    }
  }

  connectedCallback() {
    // default to open on start
    this.isOpen = true;
    this.setAttribute('open', '');
    this.style.setProperty('--drawer-height', `${this.lastHeight}px`);
    this.render();
    this.setupEventListeners();
  }

  private updateChildren() {
    const variableList = this.shadowRoot?.querySelector('nc-variable-list');
    if (variableList) {
      variableList.setAttribute('channel-id', this.channelId);
    }
    const errorList = this.shadowRoot?.querySelector('nc-error-list');
    if (errorList) {
      errorList.setAttribute('channel-id', this.channelId);
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 34px; /* closed tab height */
          overflow: hidden;
          background: #252526;
          color: #d4d4d4;
          font-family: monospace;
          font-size: 12px;
          border-top: 1px solid #3e3e42;
          transition: height 0.15s ease;
          display: flex;
          flex-direction: column;
        }

        :host([open]) {
          height: var(--drawer-height, 280px);
        }

        @media (max-width: 768px) {
          :host([open]) {
            height: var(--drawer-height, 200px);
            max-height: 50%;
          }
        }

        .resizer {
          height: 8px;
          cursor: ns-resize;
          display: block;
          background: transparent;
          flex-shrink: 0;
        }

        /* Hide resizer when closed */
        :host(:not([open])) #resizer {
          display: none;
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
          height: 34px;
          flex-shrink: 0;
        }

        .tabs {
          display: flex;
          height: 100%;
        }

        .tab {
          padding: 0 12px;
          height: 100%;
          display: flex;
          align-items: center;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          color: #888;
          font-weight: bold;
        }

        .tab:hover {
          color: #d4d4d4;
          background: rgba(255, 255, 255, 0.05);
        }

        .tab.active {
          color: #d4d4d4;
          border-bottom-color: #0e639c;
          background: rgba(255, 255, 255, 0.05);
        }
        
        .tab.error-tab.has-errors {
            color: #f48771;
        }
        
        .tab.error-tab.active {
            border-bottom-color: #f48771;
        }

        .drawer-controls {
          display: flex;
          align-items: center;
        }

        .close-button {
          padding: 4px 8px;
          background: #3c3c3c;
          color: #d4d4d4;
          border: 1px solid #555;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        }

        .close-button:hover {
          background: #4c4c4c;
        }

        .content-area {
          flex: 1;
          overflow: hidden;
          display: none; /* Hidden by default, shown when open */
        }

        :host([open]) .content-area {
          display: block;
        }

        .tab-pane {
          display: none;
          height: 100%;
        }

        .tab-pane.active {
          display: block;
        }
      </style>

      <div id="resizer" class="resizer" title="Drag to resize / click to toggle"></div>
      <div class="drawer-header">
        <div class="tabs">
          <div class="tab active" data-tab="variables">Variables</div>
          <div class="tab error-tab" data-tab="errors">Errors <span id="error-count"></span></div>
        </div>
        <div class="drawer-controls">
          <button class="close-button" id="close-toggle">Close</button>
        </div>
      </div>
      <div class="content-area">
        <div class="tab-pane active" id="pane-variables">
          <nc-variable-list channel-id="${this.channelId}"></nc-variable-list>
        </div>
        <div class="tab-pane" id="pane-errors">
          <nc-error-list channel-id="${this.channelId}"></nc-error-list>
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    // Toggle button
    const closeButton = this.shadowRoot?.getElementById('close-toggle') as HTMLButtonElement | null;
    if (closeButton) {
      closeButton.textContent = this.isOpen ? 'Close' : 'Open';
      closeButton.addEventListener('click', () => {
        this.toggle();
        closeButton.textContent = this.isOpen ? 'Close' : 'Open';
      });
    }

    // Resizer
    const resizer = this.shadowRoot?.getElementById('resizer');
    if (resizer) {
      let dragging = false;
      let startY = 0;
      let startHeight = 0;

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging) return;
        const delta = startY - ev.clientY;
        const newHeight = Math.max(this.minHeight, startHeight + delta);
        this.lastHeight = newHeight;
        this.style.setProperty('--drawer-height', `${this.lastHeight}px`);

        if (!this.isOpen) {
          this.isOpen = true;
          this.setAttribute('open', '');
          if (closeButton) closeButton.textContent = 'Close';
        }
      };

      const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      resizer.addEventListener('pointerdown', (e: PointerEvent) => {
        dragging = true;
        startY = e.clientY;
        startHeight = this.getBoundingClientRect().height;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });

      resizer.addEventListener('click', () => {
        if (!dragging) {
          this.toggle();
          if (closeButton) closeButton.textContent = this.isOpen ? 'Close' : 'Open';
        }
      });
    }

    // Tabs
    const tabs = this.shadowRoot?.querySelectorAll('.tab');
    tabs?.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
          // If closed, open it when clicking a tab
          if (!this.isOpen) {
            this.toggle();
            if (closeButton) closeButton.textContent = 'Close';
          }
        }
      });
    });

    // Listen for error updates from the error list
    this.addEventListener('errors-updated', ((e: CustomEvent) => {
      const count = e.detail.count;
      const errorTab = this.shadowRoot?.querySelector('.tab[data-tab="errors"]');
      const errorCountSpan = this.shadowRoot?.getElementById('error-count');

      if (errorCountSpan) {
        errorCountSpan.textContent = count > 0 ? `(${count})` : '';
      }

      if (errorTab) {
        if (count > 0) {
          errorTab.classList.add('has-errors');
          // Auto-switch to errors tab if we have errors
          this.switchTab('errors');
          // And ensure panel is open
          if (!this.isOpen) {
            this.toggle();
            if (closeButton) closeButton.textContent = 'Close';
          }
        } else {
          errorTab.classList.remove('has-errors');
        }
      }
    }) as EventListener);
  }

  private switchTab(tabName: string) {
    // Update tabs
    const tabs = this.shadowRoot?.querySelectorAll('.tab');
    tabs?.forEach((tab) => {
      if ((tab as HTMLElement).dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update panes
    const panes = this.shadowRoot?.querySelectorAll('.tab-pane');
    panes?.forEach((pane) => {
      if (pane.id === `pane-${tabName}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.setAttribute('open', '');
      this.style.setProperty('--drawer-height', `${this.lastHeight}px`);
    } else {
      this.removeAttribute('open');
    }
  }
}

customElements.define('nc-bottom-panel', NCBottomPanel);
