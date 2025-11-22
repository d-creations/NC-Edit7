export class NCVariableList extends HTMLElement {
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
      <div>Variables (1-999)</div>
      <!-- TODO: Implement variable list -->
    `;
  }
}

customElements.define('nc-variable-list', NCVariableList);
