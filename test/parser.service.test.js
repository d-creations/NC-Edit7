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
