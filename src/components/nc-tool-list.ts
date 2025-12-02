import type { ChannelState } from "../domain/models.js";
import type { ToolValue } from "../core/types.js";

const styles = `
:host {
  display: block;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #dbe8ff;
}

.panel {
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: rgba(12, 14, 25, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 20px rgba(3, 4, 7, 0.6);
}

.panel h3 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8fb1ff;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
}

.list li {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  gap: 4px;
}

.list li:last-child {
  border-bottom: none;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge {
  font-weight: 600;
  color: #81b1ff;
}

.tool-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-group label {
  color: #9cdcfe;
  font-size: 11px;
}

.input-group input {
  width: 50px;
  padding: 2px 4px;
  background: #3c3c3c;
  color: #d4d4d4;
  border: 1px solid #555;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

.input-group input:focus {
  outline: none;
  border-color: #569cd6;
}

.no-data {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}
`;

export class NcToolList extends HTMLElement {
  private _state?: ChannelState;
  private toolValues = new Map<number, { q?: number; r?: number }>();

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

  getToolValues(): ToolValue[] {
    const result: ToolValue[] = [];
    this.toolValues.forEach((val, toolNumber) => {
      if (val.q !== undefined || val.r !== undefined) {
        result.push({
          toolNumber,
          qValue: val.q,
          rValue: val.r,
        });
      }
    });
    return result;
  }

  private render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._state) {
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <div class="panel">
          <h3>Tool usage</h3>
          <p class="no-data">Waiting for channel data…</p>
        </div>`;
      return;
    }

    const toolUsage = this._state.parseResult?.toolUsage ?? [];
    // Get unique tool numbers
    const tools = Array.from(new Set(toolUsage.map(u => u.toolNumber))).sort((a, b) => a - b);

    const listContent = tools.map((toolNumber) => {
      const values = this.toolValues.get(toolNumber) || {};
      return `
        <li>
          <div class="tool-header">
            <span class="badge">T${toolNumber}</span>
          </div>
          <div class="tool-inputs">
            <div class="input-group">
              <label>Q:</label>
              <input type="number" 
                     data-tool="${toolNumber}" 
                     data-type="q" 
                     value="${values.q !== undefined ? values.q : ''}" 
                     placeholder="Q" step="any">
            </div>
            <div class="input-group">
              <label>R:</label>
              <input type="number" 
                     data-tool="${toolNumber}" 
                     data-type="r" 
                     value="${values.r !== undefined ? values.r : ''}" 
                     placeholder="R" step="any">
            </div>
          </div>
        </li>
      `;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <h3>Tool usage (Q/R)</h3>
        <ul class="list" id="tool-list">
          ${listContent || '<li class="no-data">No tool entries yet.</li>'}
        </ul>
      </div>
    `;

    this.attachListeners();
  }

  private attachListeners() {
    const list = this.shadowRoot?.getElementById('tool-list');
    if (!list) return;

    list.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName === 'INPUT') {
        const toolNumber = parseInt(target.dataset.tool || '0', 10);
        const type = target.dataset.type;
        const value = target.value ? parseFloat(target.value) : undefined;

        const current = this.toolValues.get(toolNumber) || {};
        if (type === 'q') {
          current.q = value;
        } else if (type === 'r') {
          current.r = value;
        }
        this.toolValues.set(toolNumber, current);
      }
    });
  }
}

customElements.define("nc-tool-list", NcToolList);
