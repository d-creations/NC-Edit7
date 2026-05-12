import './NCErrorList';

export class NCErrorsPanelContent extends HTMLElement {
  private channelId = '';

  static get observedAttributes() {
    return ['channel-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
      this.updateChild();
    }
  }

  connectedCallback() {
    this.render();
  }

  private updateChild() {
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
          height: 100%;
        }

        nc-error-list {
          display: block;
          height: 100%;
        }
      </style>

      <nc-error-list channel-id="${this.channelId}"></nc-error-list>
    `;
  }
}

customElements.define('nc-errors-panel-content', NCErrorsPanelContent);