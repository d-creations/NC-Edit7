import { test } from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../dist/core/eventBus.js";

test("EventBus unsubscribes listeners", () => {
  const bus = new EventBus();
  let seen = 0;
  const unbind = bus.on("foo", () => {
    seen += 1;
  });

  bus.emit("foo", undefined);
  assert.strictEqual(seen, 1);

  unbind();
  bus.emit("foo", undefined);
  assert.strictEqual(seen, 1, "Listener should not fire after unsubscribe");
});
