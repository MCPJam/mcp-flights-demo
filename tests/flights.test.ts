import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../demo.ts";
import {
  initialFlights,
  applyChange,
  changeSchema,
  type Flight,
} from "../flights.ts";
test("delay is measured from scheduled departure; cancellation removes estimates; reset restores times", () => {
  const original = initialFlights(1795000000000)[0];
  const delayed = applyChange(original, {
    flightId: "MJ204",
    status: "delayed",
    delayMinutes: 45,
  });
  const later = applyChange(delayed, {
    flightId: "MJ204",
    status: "delayed",
    delayMinutes: 120,
  });
  assert.equal(
    Date.parse(later.estimatedDeparture!) -
      Date.parse(original.scheduledDeparture),
    120 * 60000,
  );
  const cancelled = applyChange(later, {
    flightId: "MJ204",
    status: "cancelled",
  });
  assert.equal(cancelled.estimatedArrival, null);
  const reset = applyChange(cancelled, {
    flightId: "MJ204",
    status: "on_time",
  });
  assert.equal(reset.estimatedDeparture, original.scheduledDeparture);
  assert.equal(reset.delayMinutes, 0);
});
test("invalid, unknown and inconsistent flight updates are rejected", () => {
  for (const input of [
    { flightId: "unknown", status: "cancelled" },
    { flightId: "MJ204", status: "delayed" },
    { flightId: "MJ204", status: "delayed", delayMinutes: -1 },
    { flightId: "MJ204", status: "cancelled", delayMinutes: 10 },
  ])
    assert.equal(changeSchema.safeParse(input).success, false);
});
test("flight state survives server reconstruction and concurrent changes serialize", async () => {
  let saved: Flight[] | undefined;
  const store = {
    load: async () => structuredClone(saved),
    save: async (f: Flight[]) => {
      saved = structuredClone(f);
    },
  };
  const demo = createDemo({ getPrincipal: () => "test" }, store);
  try {
    await Promise.all([
      demo.simulate({ flightId: "MJ204", status: "delayed", delayMinutes: 45 }),
      demo.simulate({ flightId: "MJ204", status: "cancelled" }),
    ]);
    assert.equal((await demo.getFlight("MJ204")).revision, 2);
    const restored = createDemo({ getPrincipal: () => "test" }, store);
    try {
      assert.equal((await restored.getFlight("MJ204")).status, "cancelled");
      assert.equal(
        (await restored.simulate({ flightId: "MJ204", status: "cancelled" }))
          .emitted,
        false,
      );
    } finally {
      await restored.stop();
      await restored.handler.close();
    }
  } finally {
    await demo.stop();
    await demo.handler.close();
  }
});
