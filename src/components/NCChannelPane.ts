import './NCCodePane';
import './NCKeywordPanel';
import './NCVariableList';
import './NCToolList';
import './NCExecutedList';
import './NCBottomPanel';
import { ServiceRegistry } from '@core/ServiceRegistry';
import { EVENT_BUS_TOKEN, STATE_SERVICE_TOKEN } from '@core/ServiceTokens';
import { EventBus, EVENT_NAMES } from '@services/EventBus';

export class NCChannelPane extends HTMLElement {
  private channelId: string = '';
  private eventBus: EventBus;
  private stateService: import('@services/StateService').StateService;

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
    const registry = ServiceRegistry.getInstance();
    this.eventBus = registry.get(EVENT_BUS_TOKEN);
    this.stateService = registry.get(STATE_SERVICE_TOKEN);
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
    // Mobile Sidebar Toggle
    const sidebarToggle = this.querySelector('#sidebar-toggle');
    const sidebar = this.querySelector('#channel-sidebar');
    const overlay = this.querySelector('#sidebar-overlay');

    const toggleSidebar = () => {
      sidebar?.classList.toggle('visible');
      overlay?.classList.toggle('visible');
      sidebarToggle?.classList.toggle('active');
    };

    sidebarToggle?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    // Plot button
    const plotButton = this.querySelector('#plot-channel-btn');
    plotButton?.addEventListener('click', () => {
      try {
        // Ensure the plot viewer is opened (same UX as mobile)
        this.stateService.updateUISettings({ plotViewerOpen: true });
      } catch (e) {
        console.warn('StateService unavailable when opening plot viewer from channel', e);
      }

      this.eventBus.publish(EVENT_NAMES.PLOT_REQUEST, { channelId: this.channelId });
    });

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

      // On mobile, close sidebar after selection
      if (window.innerWidth <= 768) {
        sidebar?.classList.remove('visible');
        overlay?.classList.remove('visible');
        sidebarToggle?.classList.remove('active');
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
        .mobile-sidebar-toggle {
          display: none;
        }

        /* Mobile Styles */
        @media (max-width: 768px) {
          .channel-sidebar {
            display: none;
            position: absolute;
            top: 45px; /* Increased from 35px to account for taller buttons */
            left: 0;
            height: calc(100% - 45px); /* Updated to match new top position */
            width: 85%;
            max-width: 300px;
            background: #252526;
            z-index: 50;
            border-right: 1px solid #3e3e42;
            box-shadow: 2px 0 10px rgba(0,0,0,0.5);
          }
          
          .channel-sidebar.visible {
            display: flex;
          }

          .mobile-sidebar-toggle {
            display: block !important;
          }
          
          .sidebar-overlay {
            display: none;
            position: absolute;
            top: 45px; /* Updated to match sidebar top position */
            left: 0;
            width: 100%;
            height: calc(100% - 45px); /* Updated to match sidebar height */
            background: rgba(0,0,0,0.5);
            z-index: 40;
          }
          
          .sidebar-overlay.visible {
            display: block;
          }

          .mobile-sidebar-toggle {
            display: block !important;
            padding: 8px 16px !important;
            font-size: 14px !important;
            min-height: 36px !important;
          }

          .channel-button {
            padding: 6px 12px !important;
            font-size: 13px !important;
            min-height: 32px !important;
          }
        }
      </style>
      <div class="channel-header">
        <span>Channel ${this.channelId}</span>
        <div class="channel-controls">
          <button class="channel-button" id="plot-channel-btn">▶️ Plot</button>
          <button class="channel-button mobile-sidebar-toggle" id="sidebar-toggle">Tools & Keywords</button>
        </div>
      </div>
      <div class="channel-content">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <div class="channel-sidebar" id="channel-sidebar">
          <nc-keyword-panel channel-id="${this.channelId}" style="flex: 1;"></nc-keyword-panel>
          <div class="channel-tools-panel">
            <nc-tool-list channel-id="${this.channelId}"></nc-tool-list>
          </div>
        </div>
        <div class="channel-editor-area">
          <div class="channel-editor-wrapper">
            <nc-code-pane channel-id="${this.channelId}"></nc-code-pane>
          </div>
          <nc-bottom-panel channel-id="${this.channelId}" id="bottom-panel"></nc-bottom-panel>
        </div>
      </div>
    `;

    // variable drawer is self-contained (toggle/resize handled inside component)
  }
}

customElements.define('nc-channel-pane', NCChannelPane);
