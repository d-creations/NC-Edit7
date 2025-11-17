const styles = `
:host {
  display: block;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #ecf0ff;
}

.panel {
  border: 1px solid #1f2338;
  background: linear-gradient(180deg, #111427, #0b0d1c);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 10px 30px rgba(5, 6, 12, 0.8);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #8fb1ff;
}

.summary {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  font-size: 0.85rem;
}

.metrics div {
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.error-list {
  font-size: 0.8rem;
  margin-top: 0.75rem;
  max-height: 110px;
  overflow: auto;
}

.error-list li {
  margin-bottom: 0.35rem;
  color: #ff7a7a;
}
`;
export class NcChannelPanel extends HTMLElement {
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
    formatErrors(errors) {
        if (!errors.length) {
            return `<li class="empty">No parser errors</li>`;
        }
        return errors
            .map((error) => `<li>Line ${error.lineNumber}: ${error.message}</li>`)
            .join("");
    }
    render() {
        if (!this.shadowRoot) {
            return;
        }
        if (!this._state) {
            this.shadowRoot.innerHTML = `<p>No channel state available yet.</p>`;
            return;
        }
        const { channelId, errors, timeline, parseResult } = this._state;
        const lineCount = parseResult?.summary.lineCount ?? 0;
        const toolCount = parseResult?.toolUsage.length ?? 0;
        const summaryText = parseResult
            ? `${lineCount} lines parsed · ${parseResult.summary.parsedAt ? new Date(parseResult.summary.parsedAt).toLocaleTimeString() : "-"}`
            : "No parse result";
        this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <div class="panel-header">
          <span>${channelId}</span>
          <span>${timeline.length} timeline entries</span>
        </div>
        <div class="summary">${summaryText}</div>
        <div class="metrics">
          <div>Lines: ${lineCount}</div>
          <div>Tools: ${toolCount}</div>
          <div>Errors: ${errors.length}</div>
        </div>
        <ul class="error-list" aria-live="polite">${this.formatErrors(errors)}</ul>
      </div>
    `;
    }
}
customElements.define("nc-channel-panel", NcChannelPanel);
//# sourceMappingURL=channel-panel.js.map