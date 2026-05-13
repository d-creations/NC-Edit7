import './NCVariableList';
import type { CustomVariable } from '@core/types';
import type { NCVariableList } from './NCVariableList';

export class NCVariablesPanelContent extends HTMLElement {
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

  getCustomVariables(): CustomVariable[] {
    const variableList = this.shadowRoot?.querySelector(
      'nc-variable-list',
    ) as NCVariableList | null;
    return variableList ? variableList.getCustomVariables() : [];
  }

  private updateChild() {
    const variableList = this.shadowRoot?.querySelector('nc-variable-list');
    if (variableList) {
      variableList.setAttribute('channel-id', this.channelId);
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        nc-variable-list {
          display: flex;
          flex: 1;
          width: 100%;
          height: 100%;
          min-height: 0;
        }
      </style>

      <nc-variable-list channel-id="${this.channelId}"></nc-variable-list>
    `;
  }
}

customElements.define('nc-variables-panel-content', NCVariablesPanelContent);