import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../demo.ts";
import {
  initialFlights,
  applyChange,
  localTimes,
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
test("rebooking needs a delay or cancellation and moves to the later flight once", async () => {
  const demo = createDemo({ getPrincipal: () => "test" });
  try {
    await assert.rejects(demo.rebook("MJ204"), /on time/);
    await demo.simulate({ flightId: "MJ204", status: "delayed", delayMinutes: 180 });
    const first = await demo.rebook("MJ204");
    const original = await demo.getFlight("MJ204");
    assert.equal(first.flight.flightId, "MJ208");
    assert.equal(first.flight.status, "on_time");
    assert.equal(
      Date.parse(first.flight.scheduledDeparture) -
        Date.parse(original.scheduledDeparture),
      2 * 3600000,
    );
    assert.deepEqual((await demo.rebook("MJ204")).flight, first.flight);
    assert.equal((await demo.listFlights()).length, 3);
    await assert.rejects(demo.rebook("MJ208"), /on time/);
  } finally {
    await demo.stop();
    await demo.handler.close();
  }
});
test("local times name the airport's own zone", () => {
  const times = localTimes(initialFlights(1795000000000)[0]);
  assert.match(times.scheduledDeparture!, /^Thu, Nov 19, 8:00\sAM PST$/);
  assert.match(times.scheduledArrival!, /^Thu, Nov 19, 4:30\sPM EST$/);
});
