export class NCStatusIndicator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        .status {
          padding: 2px 8px;
          border-radius: 4px;
          background: #007acc;
          color: white;
        }
      </style>
      <span class="status">Ready</span>
    `;
  }
}

customElements.define('nc-status-indicator', NCStatusIndicator);
