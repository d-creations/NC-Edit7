import { eventBus, updateChannelProgram } from "../app-context.js";
import "./channel-panel.js";
import "./nc-code-pane.js";
import "./nc-tool-list.js";
import "./nc-variable-list.js";
import "./nc-executed-list.js";
import type { ChannelState } from "../domain/models.js";
import { BackendGateway } from "../services/BackendGateway.js";
import { ExecutedProgramService } from "../services/ExecutedProgramService.js";
import { EventBus as ServiceEventBus } from "../services/EventBus.js";
import { NcToolList } from "./nc-tool-list.js";
import { NcVariableList } from "./nc-variable-list.js";

type ChannelStateElement = HTMLElement & {
  channelState: ChannelState | undefined;
};

const CHANNEL_ID = "1";
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

    .panel-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

    .button-row {
      display: flex;
      gap: 8px;
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

    button.secondary {
      background: linear-gradient(120deg, #4a4a4a, #666);
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
        
        <div style="margin-bottom: 0.5rem;">
            <label for="machineSelector" style="display:block; margin-bottom: 0.25rem; font-size: 0.9rem;">Machine Control</label>
            <select id="machineSelector" style="width: 100%; padding: 0.5rem; border-radius: 6px; background: #0b0d1b; color: #fff; border: 1px solid rgba(255,255,255,0.2);">
                <option value="ISO_MILL">Loading machines...</option>
            </select>
        </div>

        <label for="programInput">NC Program</label>
        <textarea id="programInput" spellcheck="false"></textarea>
        <div class="button-row">
          <button id="parseButton" type="button">Parse channel</button>
          <button id="plotButton" type="button" class="secondary">Plot (Server)</button>
        </div>
      </div>

      <div class="panel-stack">
        <nc-code-pane channel-id="${CHANNEL_ID}"></nc-code-pane>
        <div class="panel-columns">
          <nc-channel-panel></nc-channel-panel>
          <nc-tool-list></nc-tool-list>
          <nc-variable-list></nc-variable-list>
          <nc-executed-list></nc-executed-list>
        </div>
      </div>
    </div>
`;

export class NcEditorApp extends HTMLElement {
  private subscriptions: Array<() => void> = [];
  private parseButton?: HTMLButtonElement;
  private plotButton?: HTMLButtonElement;
  private programInput?: HTMLTextAreaElement;
  private statusLabel?: HTMLElement;
  private executedProgramService: ExecutedProgramService;
  private backend: BackendGateway;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    if (this.shadowRoot) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    // Initialize services
    this.backend = new BackendGateway();
    const serviceEventBus = new ServiceEventBus();
    this.executedProgramService = new ExecutedProgramService(this.backend, serviceEventBus);
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      return;
    }

    this.parseButton = this.shadowRoot.querySelector("#parseButton") ?? undefined;
    this.plotButton = this.shadowRoot.querySelector("#plotButton") ?? undefined;
    this.programInput = this.shadowRoot.querySelector("#programInput") ?? undefined;
    this.statusLabel = this.shadowRoot.querySelector("#statusLabel") ?? undefined;

    if (this.programInput && !this.programInput.value.trim()) {
      this.programInput.value = DEFAULT_PROGRAM;
    }

    const parseHandler = () => this.handleParse();
    this.parseButton?.addEventListener("click", parseHandler);
    this.subscriptions.push(() => this.parseButton?.removeEventListener("click", parseHandler));

    const plotHandler = () => this.handlePlot();
    this.plotButton?.addEventListener("click", plotHandler);
    this.subscriptions.push(() => this.plotButton?.removeEventListener("click", plotHandler));

    this.subscriptions.push(
      eventBus.on("channelUpdated", ({ state }) => this.renderChannelState(state))
    );

    this.dispatchInitialParse();
    this.loadMachines();
  }

  private async loadMachines() {
    const selector = this.shadowRoot?.querySelector("#machineSelector") as HTMLSelectElement;
    if (!selector) return;

    try {
      const response = await this.backend.listMachines();
      if (response.success && response.machines) {
        selector.innerHTML = "";
        response.machines.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.machineName;
            opt.textContent = `${m.machineName} (${m.controlType})`;
            selector.appendChild(opt);
        });
        // Select ISO_MILL by default if available, or the first one
        if (response.machines.some(m => m.machineName === "ISO_MILL")) {
            selector.value = "ISO_MILL";
        }
      } else {
          selector.innerHTML = "<option>Failed to load machines</option>";
      }
    } catch (e) {
        console.error("Failed to load machines", e);
        selector.innerHTML = "<option>Error loading machines</option>";
    }
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

  private async handlePlot() {
    const program = this.programInput?.value.trim() ?? "";
    if (!program) return;

    this.statusLabel?.replaceChildren("Requesting Plot...");

    const toolList = this.shadowRoot?.querySelector("nc-tool-list") as NcToolList;
    const variableList = this.shadowRoot?.querySelector("nc-variable-list") as NcVariableList;
    const selector = this.shadowRoot?.querySelector("#machineSelector") as HTMLSelectElement;
    const machineName = selector?.value || "ISO_MILL";

    const toolValues = toolList?.getToolValues();
    const customVariables = variableList?.getCustomVariables();

    try {
      const result = await this.executedProgramService.executeProgram({
        channelId: CHANNEL_ID,
        program,
        machineName: machineName as any,
        toolValues,
        customVariables,
      });
      
      this.statusLabel?.replaceChildren("Plot Received");
      console.log("Plot Result:", result);
      // TODO: Update UI with plot result (e.g. executed list, 3D view)
      
    } catch (error) {
      console.error("Plot failed:", error);
      this.statusLabel?.replaceChildren("Plot Failed");
    }
  }

  private renderChannelState(state: ChannelState) {
    if (this.statusLabel) {
      this.statusLabel.textContent = "Last parsed at " + new Date(state.lastUpdated).toLocaleTimeString();
    }

    this.updateChannelPanels(state);
  }

  private updateChannelPanels(state: ChannelState) {
    if (!this.shadowRoot) {
      return;
    }

    const selectors = [
      "nc-channel-panel",
      "nc-tool-list",
      "nc-variable-list",
      "nc-executed-list",
    ];

    for (const selector of selectors) {
      const element = this.shadowRoot.querySelector(selector) as ChannelStateElement | null;
      if (element) {
        element.channelState = state;
      }
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
