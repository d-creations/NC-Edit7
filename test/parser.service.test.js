import { test } from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../dist/core/eventBus.js";
import { ParserService } from "../dist/services/parser/parserService.js";

test("ParserService extracts tool/sync events and reports errors on comment-only lines", () => {
  const eventBus = new EventBus();
  const parser = new ParserService(eventBus);
  const program = "N1 G01 X10 M200\nN2 T0204 (tool change)\n(footer comment)";
  const result = parser.parse("chan", program);

  assert.strictEqual(result.summary.lineCount, 3);
  assert.strictEqual(result.errors.length, 1);
  assert.ok(result.syncEvents.some((event) => event.keyword === "M200"));
  assert.ok(result.syncEvents.some((event) => event.keyword === "T0204"));
  assert.strictEqual(result.toolUsage[0].toolNumber, 204);
});

test("ParserService emits parseCompleted with the result", () => {
  const eventBus = new EventBus();
  const parser = new ParserService(eventBus);
  let captured;

  eventBus.on("parseCompleted", ({ result }) => {
    captured = result;
  });

  const program = "N1 G00 X0\nN2 G01 X10";
  const result = parser.parse("chan", program);

  assert.ok(captured, "parseCompleted should have fired");
  assert.strictEqual(captured.summary.lineCount, result.summary.lineCount);
});

test("ParserService handles empty programs without errors", () => {
  const eventBus = new EventBus();
  const parser = new ParserService(eventBus);
  const result = parser.parse("chan", "");

  assert.strictEqual(result.summary.lineCount, 1);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.syncEvents.length, 0);
});
