import { test } from "node:test";
import assert from "node:assert/strict";
import { readRpc, newTrip, verifySessionToken } from "../gateway.ts";

test("anonymous trip handles are isolated, signed and expire", async () => {
  const secret = "a-test-signing-secret-not-used-for-real-trips";
  const a = await newTrip(secret),
    b = await newTrip(secret);
  assert.notEqual(a.tripId, b.tripId);
  assert.ok(await verifySessionToken(secret, a.tripId));
  assert.equal(await verifySessionToken(secret, a.tripId, a.expiresAt), null);
  assert.equal(await verifySessionToken("different-secret", a.tripId), null);
});
test("routing preserves the exact RPC and does not trust headers as trip identity", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "events/stream",
    params: {
      name: "flight.status_changed",
      arguments: { tripId: "trip-a", flightId: "MJ204" },
    },
  });
  const parsed = await readRpc(
    new Request("http://localhost/mcp", {
      method: "POST",
      body,
      headers: { "x-demo-trip-id": "trip-b" },
    }),
  );
  assert.equal(parsed.message?.params?.arguments?.tripId, "trip-a");
  assert.equal(await parsed.request.text(), body);
});
test("routing leaves malformed JSON to the SDK and bounds streamed bodies", async () => {
  const bad = await readRpc(
    new Request("http://localhost/mcp", { method: "POST", body: "{" }),
  );
  assert.equal(bad.message, undefined);
  assert.equal(await bad.request.text(), "{");
  await assert.rejects(
    readRpc(
      new Request("http://localhost/mcp", {
        method: "POST",
        body: "x".repeat(65537),
      }),
    ),
    /too large/,
  );
});
