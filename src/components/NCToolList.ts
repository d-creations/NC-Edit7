export class NCToolList extends HTMLElement {
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
          display: block;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 8px;
        }
      </style>
      <div>Tool List</div>
      <!-- TODO: Implement tool list -->
    `;
  }
}

customElements.define('nc-tool-list', NCToolList);
