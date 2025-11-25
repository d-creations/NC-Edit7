import { test } from "node:test";
import assert from "node:assert/strict";

function applyDomGlobals(dom) {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    customElements: globalThis.customElements,
    HTMLElement: globalThis.HTMLElement,
    Event: globalThis.Event,
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.customElements = dom.window.customElements;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.customElements = previous.customElements;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.Event = previous.Event;
  };
}

test("nc-code-pane reflects channel updates emitted via EventBus", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable",
  });

  const cleanup = applyDomGlobals(dom);
  try {
    await dom.window.customElements.whenDefined("nc-code-pane").catch(() => {});
    await import("../dist/components/nc-code-pane.js");
    const { eventBus } = await import("../dist/app-context.js");

    const pane = dom.window.document.createElement("nc-code-pane");
    pane.setAttribute("channel-id", "CH1");
    dom.window.document.body.appendChild(pane);
    await dom.window.customElements.whenDefined("nc-code-pane");

    const parseResult = {
      lines: [
        { lineNumber: 1, rawLine: "N1 G00 X0", strippedLine: "N1 G00 X0", tokens: ["N1", "G00", "X0"] },
        { lineNumber: 2, rawLine: "N2 G01 X10", strippedLine: "N2 G01 X10", tokens: ["N2", "G01", "X10"] },
      ],
      syncEvents: [],
      errors: [],
      toolUsage: [],
      summary: { lineCount: 2, parsedAt: Date.now() },
    };

    const channelState = {
      channelId: "CH1",
      program: "N1 G00 X0; N2 G01 X10",
      parseResult,
      errors: [],
      timeline: [1, 2],
      lastUpdated: Date.now(),
    };

    eventBus.emit("channelUpdated", { state: channelState });

    const lineElements = pane.shadowRoot?.querySelectorAll(".line");
    assert.strictEqual(lineElements?.length, parseResult.lines.length);

    const summaryText = pane.shadowRoot?.querySelector("#summaryText")?.textContent;
    assert(summaryText?.includes("last parsed"));
  } finally {
    cleanup();
  }
});
