import assert from "node:assert/strict";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  EventsClientExtension,
  type EventSubscription,
} from "@modelcontextprotocol/client/ext/events";

const url = process.argv[2] ?? "http://127.0.0.1:18891/mcp";
const clients: Client[] = [];
const subscriptions: EventSubscription[] = [];
const deadline = setTimeout(() => {
  console.error("Isolation test timed out");
  process.exit(1);
}, 30_000);
async function connect() {
  const events = new EventsClientExtension();
  const client = new Client(
    { name: "isolation-test", version: "1" },
    {
      versionNegotiation: { mode: "auto" },
      extensions: [events],
    },
  );
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const created = await client.callTool({
    name: "create_demo_trip",
    arguments: {},
  });
  assert.equal(created.isError, undefined);
  const { tripId } = created.structuredContent as { tripId: string };
  assert.ok(tripId);
  return { client, events, tripId };
}
async function first(sub: EventSubscription) {
  for await (const event of sub) return event;
  throw new Error("No event");
}
try {
  assert.notEqual((await fetch(url, { method: "POST" })).status, 401);
  const a = await connect();
  const b = await connect();
  assert.notEqual(a.tripId, b.tripId);
  const endpoint = new URL("/demo/flight", url);
  assert.equal((await fetch(endpoint)).status, 410);
  const forged = await a.client.callTool({
    name: "get_flight",
    arguments: { tripId: "forged", flightId: "MJ204" },
  });
  assert.equal(forged.isError, true);
  const noTrip = await a.client.callTool({
    name: "get_flight",
    arguments: { flightId: "MJ204" },
  });
  assert.equal(noTrip.isError, true);
  // An expired/tampered handle cannot select a Durable Object or cause an OAuth prompt.
  const staleId = a.tripId.split(".");
  staleId[1] = String(Date.now() - 1000);
  const stale = await a.client.callTool({
    name: "get_flight",
    arguments: { tripId: staleId.join("."), flightId: "MJ204" },
  });
  assert.equal(stale.isError, true);
  assert.equal(
    (await a.client.listTools()).tools.some(
      (t) => t.name === "create_demo_trip",
    ),
    true,
  );
  const headers = { "Content-Type": "application/json" };
  const post = (tripId: string, data: Record<string, unknown>) =>
    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ tripId, ...data }),
    });
  for (const session of [a, b])
    subscriptions.push(
      await session.events.subscribe({
        name: "flight.status_changed",
        delivery: "poll",
        arguments: { tripId: session.tripId, flightId: "MJ204" },
      }),
    );
  assert.equal(
    (
      await post(a.tripId, {
        flightId: "MJ204",
        status: "delayed",
        delayMinutes: 0,
      })
    ).status,
    400,
  );
  const invalid = await fetch(endpoint, {
    method: "POST",
    headers,
    body: "{",
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    (
      await post(a.tripId, {
        flightId: "MJ204",
        status: "delayed",
        delayMinutes: 45,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      (await first(subscriptions[0])).data as {
        flight: { delayMinutes: number };
      }
    ).flight.delayMinutes,
    45,
  );
  const bState = (await fetch(
    new URL("?tripId=" + encodeURIComponent(b.tripId), endpoint),
  ).then((r) => r.json())) as { flights: Array<{ status: string }> };
  assert.equal(bState.flights[0].status, "on_time");
  assert.equal(
    (await post(b.tripId, { flightId: "MJ204", status: "cancelled" })).status,
    200,
  );
  assert.equal(
    ((await first(subscriptions[1])).data as { flight: { status: string } })
      .flight.status,
    "cancelled",
  );
  const aState = await a.client.callTool({
    name: "get_flight",
    arguments: { tripId: a.tripId, flightId: "MJ204" },
  });
  assert.equal(
    (aState.structuredContent as { flight: { status: string } }).flight.status,
    "delayed",
  );
  console.log(
    "PASS: anonymous connection/creation, invalid trip recovery, isolated trip state, presenter REST → MCP Event → tool readback",
  );
} finally {
  await Promise.allSettled(subscriptions.map((sub) => sub.cancel()));
  await Promise.allSettled(clients.map((client) => client.close()));
  clearTimeout(deadline);
}
