import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCodePaneRenderResult } from "../dist/components/code-pane-renderer.js";

test("renders lines and summary when parse result exists", () => {
  const now = Date.now();
  const channelState = {
    channelId: "CH1",
    program: "N1 G00 X0\nN2 G01 X10",
    parseResult: {
      lines: [
        { lineNumber: 1, rawLine: "N1 G00 X0", strippedLine: "N1 G00 X0", tokens: [] },
        { lineNumber: 2, rawLine: "(Something) N2 G01", strippedLine: "N2 G01", tokens: [] },
      ],
      syncEvents: [],
      errors: [],
      toolUsage: [],
      summary: {
        lineCount: 2,
        parsedAt: now,
      },
    },
    errors: [{ lineNumber: 2, message: "comment-only" }],
    timeline: [1, 2],
    lastUpdated: now - 1000,
  };

  const result = buildCodePaneRenderResult(channelState, "CH1");

  assert.strictEqual(result.title, "Channel CH1");
  assert.strictEqual(result.lineCountLabel, "2 lines");
  assert.strictEqual(result.errorCountLabel, "1 errors");
  assert.ok(result.summaryText.includes("last parsed"));
  assert.ok(result.contentHtml.includes("Line 1"));
  assert.ok(result.contentHtml.includes("error"));
});

// verify fallback path when parse result is missing
test("falls back when no parse result", () => {
  const channelState = {
    channelId: "CH1",
    program: "",
    errors: [],
    timeline: [],
    lastUpdated: Date.now(),
  };

  const result = buildCodePaneRenderResult(channelState, "CH1");
  assert.strictEqual(result.summaryText, "not parsed yet");
  assert.strictEqual(result.lineCountLabel, "0 lines");
});
