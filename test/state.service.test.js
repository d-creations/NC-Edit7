import { test } from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../dist/core/eventBus.js";
import { ParserService } from "../dist/services/parser/parserService.js";
import { StateService } from "../dist/services/state/stateService.js";

test("StateService builds a timeline that matches parsed line count", () => {
  const eventBus = new EventBus();
  const parser = new ParserService(eventBus);
  const stateService = new StateService(parser, eventBus);
  let updates = 0;

  eventBus.on("channelUpdated", ({ state }) => {
    updates += 1;
    assert.strictEqual(state.timeline.length, 2);
  });

  const program = "N1 G00 X0\nN2 G01 X10";
  const channelState = stateService.setChannelProgram("CH1", program);

  assert.strictEqual(channelState.timeline.length, 2);
  assert.strictEqual(updates, 1);
});

test("StateService caches the last channel state", () => {
  const eventBus = new EventBus();
  const parser = new ParserService(eventBus);
  const stateService = new StateService(parser, eventBus);

  const program = "N1 G00 X0\n";
  const firstState = stateService.setChannelProgram("CH1", program);
  const cached = stateService.getChannelState("CH1");

  assert.strictEqual(cached?.channelId, firstState.channelId);
  assert.strictEqual(cached?.program, program);
  assert.strictEqual(cached?.timeline.length, firstState.timeline.length);
});
