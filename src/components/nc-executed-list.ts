import type { ChannelState } from "../domain/models.js";

const styles = `
:host {
  display: block;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  color: #e0e8ff;
}

.panel {
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: rgba(8, 10, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.05);
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
  font-size: 0.78rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 160px;
  overflow: auto;
}

.list li {
  display: flex;
  justify-content: space-between;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.list li:last-child {
  border-bottom: none;
}

.line-number {
  color: #81b1ff;
  font-weight: 600;
}

.code-snippet {
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
  padding-left: 0.35rem;
}

.no-data {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}
`;

const ENTRY_LIMIT = 8;

export class NcExecutedList extends HTMLElement {
  private _state?: ChannelState;

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

  private render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._state) {
      this.shadowRoot.innerHTML = `<p class="no-data">No execution data yet.</p>`;
      return;
    }

    const timeline = this._state.timeline ?? [];
    const parsedLines = this._state.parseResult?.lines ?? [];

    if (!timeline.length) {
      this.shadowRoot.innerHTML = `<p class="no-data">Timeline is empty.</p>`;
      return;
    }

    const entries = timeline
      .slice(0, ENTRY_LIMIT)
      .map((lineNumber) => {
        const line = parsedLines.find((l) => l.lineNumber === lineNumber);
        return {
          lineNumber,
          snippet: line ? line.rawLine.trim() : "(line data missing)",
        };
      })
      .map(
        (entry) => `
          <li>
            <span class="line-number">L${entry.lineNumber}</span>
            <span class="code-snippet">${entry.snippet || "(blank line)"}</span>
          </li>
        `
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="panel">
        <h3>Executed lines</h3>
        <ul class="list">
          ${entries}
        </ul>
      </div>
    `;
  }
}

customElements.define("nc-executed-list", NcExecutedList);
