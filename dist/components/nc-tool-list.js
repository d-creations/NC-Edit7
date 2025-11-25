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
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.list li:last-child {
  border-bottom: none;
}

.badge {
  font-weight: 600;
  color: #81b1ff;
}

.no-data {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}
`;
export class NcToolList extends HTMLElement {
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
    render() {
        if (!this.shadowRoot) {
            return;
        }
        if (!this._state) {
            this.shadowRoot.innerHTML = `<p class="no-data">Waiting for channel data…</p>`;
            return;
        }
        const toolUsage = this._state.parseResult?.toolUsage ?? [];
        const toolMap = new Map();
        for (const usage of toolUsage) {
            const lines = toolMap.get(usage.toolNumber) ?? [];
            lines.push(usage.lineNumber);
            toolMap.set(usage.toolNumber, lines);
        }
        const listContent = Array.from(toolMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([toolNumber, lines]) => `
        <li>
          <span class="badge">T${toolNumber}</span>
          <span>${lines.map((line) => `L${line}`).join(", ")}</span>
        </li>
      `)
            .join("");
        this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <h3>Tool usage</h3>
        <ul class="list">
          ${listContent || '<li class="no-data">No tool entries yet.</li>'}
        </ul>
      </div>
    `;
    }
}
customElements.define("nc-tool-list", NcToolList);
//# sourceMappingURL=nc-tool-list.js.map