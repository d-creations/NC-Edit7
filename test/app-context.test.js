import { test } from "node:test";
import assert from "node:assert/strict";
import { stateService, updateChannelProgram } from "../dist/app-context.js";

test("App context exposes shared services and registers channel updates", () => {
  const channelId = "CH1";
  assert.strictEqual(stateService.getChannelState(channelId), undefined);

  updateChannelProgram(channelId, "N1 G00 X0");
  const updated = stateService.getChannelState(channelId);

  assert.ok(updated, "Channel state should exist after parsing");
  assert.strictEqual(updated?.channelId, channelId);
  assert.strictEqual(updated?.program.trim(), "N1 G00 X0");
  assert.strictEqual(updated?.timeline.length, 1);
});
