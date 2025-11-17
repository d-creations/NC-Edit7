import { eventBus, updateChannelProgram } from "../app-context.js";
import "./channel-panel.js";
import "./nc-code-pane.js";
import type { ChannelViewState } from "./channel-panel.js";

type ChannelPanelElement = HTMLElement & {
  channelState: ChannelViewState;
};

const CHANNEL_ID = "CH1";
const DEFAULT_PROGRAM = `N1 G00 X0 Y0 Z0\nN2 G01 X10 Y10 Z0 M200`;

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #f5f8ff;
    }

    .shell {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      padding: 1rem;
      background: radial-gradient(circle at top right, rgba(103, 132, 255, 0.4), transparent 30%), #070914;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .editor-panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: rgba(11, 14, 31, 0.8);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .panel-stack {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    textarea {
      width: 100%;
      height: 180px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: #0b0d1b;
      color: #f6f7ff;
      padding: 0.75rem;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 0.95rem;
      resize: vertical;
    }

    button {
      align-self: flex-start;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      background: linear-gradient(120deg, #5f8cfc, #81b1ff);
      border: none;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      transition: transform 100ms ease;
    }

    button:active {
      transform: scale(0.98);
    }

    .status-pills {
      display: flex;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .pill {
      padding: 0.3rem 0.6rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
    <div class="shell">
      <div class="editor-panel">
        <div class="status-pills">
          <span class="pill">Channel ${CHANNEL_ID}</span>
          <span class="pill" id="statusLabel">Idle</span>
        </div>
        <label for="programInput">NC Program</label>
        <textarea id="programInput" spellcheck="false"></textarea>
        <button id="parseButton" type="button">Parse channel</button>
      </div>

      <div class="panel-stack">
        <nc-code-pane channel-id="${CHANNEL_ID}"></nc-code-pane>
        <nc-channel-panel></nc-channel-panel>
      </div>
    </div>
`;

export class NcEditorApp extends HTMLElement {
  private subscriptions: Array<() => void> = [];
  private parseButton?: HTMLButtonElement;
  private programInput?: HTMLTextAreaElement;
  private statusLabel?: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    if (this.shadowRoot) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      return;
    }

    this.parseButton = this.shadowRoot.querySelector("#parseButton") ?? undefined;
    this.programInput = this.shadowRoot.querySelector("#programInput") ?? undefined;
    this.statusLabel = this.shadowRoot.querySelector("#statusLabel") ?? undefined;

    if (this.programInput && !this.programInput.value.trim()) {
      this.programInput.value = DEFAULT_PROGRAM;
    }

    const handler = () => this.handleParse();
    this.parseButton?.addEventListener("click", handler);

    this.subscriptions.push(() => this.parseButton?.removeEventListener("click", handler));

    this.subscriptions.push(
      eventBus.on("channelUpdated", ({ state }) => this.renderChannelState(state))
    );

    this.dispatchInitialParse();
  }

  disconnectedCallback() {
    for (const cleanup of this.subscriptions) {
      cleanup();
    }
    this.subscriptions = [];
  }

  private handleParse() {
    const program = this.programInput?.value.trim() ?? "";
    if (!program) {
      return;
    }

    this.statusLabel?.replaceChildren("Parsing…");
    updateChannelProgram(CHANNEL_ID, program);
  }

  private renderChannelState(state: ChannelViewState) {
    if (this.statusLabel) {
      this.statusLabel.textContent = "Last parsed at " + new Date(state.lastUpdated).toLocaleTimeString();
    }

    const panel = this.shadowRoot?.querySelector("nc-channel-panel") as ChannelPanelElement | null;
    if (panel) {
      panel.channelState = state;
    }
  }

  private dispatchInitialParse() {
    if (!this.programInput) {
      return;
    }

    updateChannelProgram(CHANNEL_ID, this.programInput.value);
  }
}

customElements.define("nc-editor-app", NcEditorApp);
