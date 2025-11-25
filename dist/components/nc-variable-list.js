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
`;
export class NcVariableList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }
    set channelState(state) {
        this._state = state;
        this.render();
    }
    get channelState() {
        return this._state;
    }
    extractVariables() {
        const result = new Map();
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
    render() {
        if (!this.shadowRoot) {
            return;
        }
        if (!this._state) {
            this.shadowRoot.innerHTML = `<p class="no-data">Awaiting channel updates…</p>`;
            return;
        }
        const variables = this.extractVariables();
        const listContent = Array.from(variables.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, lastLine]) => `
          <li>
            <span class="variable">${name}</span>
            <span>line ${lastLine}</span>
          </li>
        `)
            .join("");
        this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <h3>Variables</h3>
        <ul class="list">
          ${listContent || '<li class="no-data">No variables detected.</li>'}
        </ul>
      </div>
    `;
    }
}
customElements.define("nc-variable-list", NcVariableList);
//# sourceMappingURL=nc-variable-list.js.map