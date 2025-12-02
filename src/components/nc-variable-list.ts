import type { ChannelState } from "../domain/models.js";
import type { CustomVariable } from "../core/types.js";

const styles = `
:host {
  display: block;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #f5f8ff;
}

.panel {
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: rgba(10, 12, 22, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.panel h3 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8fb1ff;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.list li {
  display: flex;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}

.variable {
  color: #9af2ff;
  font-weight: 600;
}

.no-data {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
}

.custom-section {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.custom-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.custom-input {
  background: #3c3c3c;
  color: #d4d4d4;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 11px;
  width: 60px;
}

.add-button {
  background: #0e639c;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 8px;
}

.remove-button {
  background: transparent;
  border: none;
  color: #f14c4c;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
`;

export class NcVariableList extends HTMLElement {
  private _state?: ChannelState;
  private customVariables = new Map<string, number>();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set channelState(state: ChannelState | undefined) {
    this._state = state;
    this.render();
  }

  get channelState(): ChannelState | undefined {
    return this._state;
  }

  getCustomVariables(): CustomVariable[] {
    return Array.from(this.customVariables.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }

  private extractVariables(): Map<string, number> {
    const result = new Map<string, number>();
    const lines = this._state?.parseResult?.lines ?? [];

    for (const line of lines) {
      for (const token of line.tokens) {
        if (token.startsWith("#")) {
          const existingLine = result.get(token);
          if (!existingLine || line.lineNumber > existingLine) {
            result.set(token, line.lineNumber);
          }
        }
      }
    }

    return result;
  }

  private render() {
    if (!this.shadowRoot) {
      return;
    }

    const variables = this.extractVariables();
    const listContent = Array.from(variables.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, lastLine]) => `
          <li>
            <span class="variable">${name}</span>
            <span>line ${lastLine}</span>
          </li>
        `
      )
      .join("");

    const customListContent = Array.from(this.customVariables.entries())
      .map(([name, value]) => `
        <li>
          <span class="variable">${name} = ${value}</span>
          <button class="remove-button" data-name="${name}">×</button>
        </li>
      `)
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <div class="custom-section">
          <h3>Custom Variables</h3>
          <div class="custom-input-row">
            <input type="text" class="custom-input" id="custom-name" placeholder="#100">
            <input type="number" class="custom-input" id="custom-value" placeholder="Val">
            <button class="add-button" id="add-custom">+</button>
          </div>
          <ul class="list" id="custom-list">
            ${customListContent || '<li class="no-data">No custom variables</li>'}
          </ul>
        </div>

        <h3>Variables</h3>
        <ul class="list">
          ${listContent || '<li class="no-data">No variables detected.</li>'}
        </ul>
      </div>
    `;

    this.attachListeners();
  }

  private attachListeners() {
    const addButton = this.shadowRoot?.getElementById('add-custom');
    const customList = this.shadowRoot?.getElementById('custom-list');

    addButton?.addEventListener('click', () => this.addCustomVariable());

    customList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('remove-button')) {
        const name = target.dataset.name;
        if (name) {
          this.customVariables.delete(name);
          this.render();
        }
      }
    });
  }

  private addCustomVariable() {
    const nameInput = this.shadowRoot?.getElementById('custom-name') as HTMLInputElement;
    const valueInput = this.shadowRoot?.getElementById('custom-value') as HTMLInputElement;

    if (nameInput && valueInput) {
      const name = nameInput.value.trim();
      const value = parseFloat(valueInput.value);

      if (name && !isNaN(value)) {
        this.customVariables.set(name, value);
        this.render();
      }
    }
  }
}

customElements.define("nc-variable-list", NcVariableList);
