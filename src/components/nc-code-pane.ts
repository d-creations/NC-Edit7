import { eventBus } from "../app-context.js";
import type { ChannelId, ChannelState } from "../domain/models.js";
import { buildCodePaneRenderResult } from "./code-pane-renderer.js";
const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      background: rgba(7, 9, 20, 0.9);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      overflow: hidden;
      min-height: 260px;
    }

    .header {
      padding: 0.65rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.9rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8eb0ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status {
      display: flex;
      gap: 0.65rem;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .content {
      padding: 0.75rem 1rem;
      max-height: 300px;
      overflow: auto;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 0.85rem;
      line-height: 1.4;
      color: #f6f7ff;
    }

    .line {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.15rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    }

    .line:last-child {
      border-bottom: none;
    }

    .line-number {
      flex: 0 0 3rem;
      color: rgba(255, 255, 255, 0.55);
    }

    .line-text {
      flex: 1;
      word-break: break-word;
    }

    .line-text.error {
      color: #ff8c8c;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .status span {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      padding: 0.1rem 0.5rem;
    }

    .line.error {
      background: rgba(255, 89, 89, 0.08);
    }

    .line .line-number.error {
      color: #ff8c8c;
    }
  </style>
  <div class="header">
    <span id="title">Channel</span>
    <div class="status">
      <span id="lineCount">0 lines</span>
      <span id="errorCount">0 errors</span>
      <span id="summaryText">not parsed yet</span>
    </div>
  </div>
  <div class="content" id="content"></div>
`;

export class NcCodePane extends HTMLElement {
  static get observedAttributes() {
    return ["channel-id"];
  }

  private channelId: ChannelId = "CH1";
  private subscription?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    if (this.shadowRoot) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
  }

  connectedCallback() {
    this.subscription = eventBus.on("channelUpdated", ({ state }) => {
      if (state.channelId === this.channelId) {
        this.render(state);
      }
    });
  }

  disconnectedCallback() {
    this.subscription?.();
    this.subscription = undefined;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === "channel-id" && newValue) {
      this.channelId = newValue;
    }
  }

  private render(state: ChannelState) {
    const content = this.shadowRoot?.getElementById("content");
    const doorHeader = this.shadowRoot?.getElementById("title");
    const lineCount = this.shadowRoot?.getElementById("lineCount");
    const errorCount = this.shadowRoot?.getElementById("errorCount");
    const summaryText = this.shadowRoot?.getElementById("summaryText");

    if (!content || !doorHeader || !lineCount || !errorCount) {
      return;
    }

    const outputs = buildCodePaneRenderResult(state, this.channelId);

    doorHeader.textContent = outputs.title;
    lineCount.textContent = outputs.lineCountLabel;
    errorCount.textContent = outputs.errorCountLabel;
    if (summaryText) {
      summaryText.textContent = outputs.summaryText;
    }
    content.innerHTML = outputs.contentHtml;
  }
}

customElements.define("nc-code-pane", NcCodePane);
