import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  EventsClientExtension,
  type EventSubscription,
} from "@modelcontextprotocol/client/ext/events";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { getToken, port, receiverPort } from "./config.js";

const url = process.argv[2] ?? `http://127.0.0.1:${port}/mcp`;
const session =
  process.env.CREATE_SESSION === "1"
    ? await fetch(new URL("/sessions", url), { method: "POST" }).then(
        async (response) => {
          assert.equal(response.status, 200, "Create hosted demo session");
          return (await response.json()) as { token: string };
        },
      )
    : undefined;
const events = new EventsClientExtension({
  webhook: {
    url: process.env.WEBHOOK_URL ?? `http://127.0.0.1:${receiverPort}/events`,
  },
});
const client = new Client(
  { name: "mcpjam-events-smoke", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" }, extensions: [events] },
);
const receiverHandler = toNodeHandler({ fetch: events.createWebhookHandler() });
const receiver = createServer((req, res) => void receiverHandler(req, res));
await new Promise<void>((resolve, reject) => {
  receiver.once("error", reject);
  receiver.listen(receiverPort, "127.0.0.1", resolve);
});
const timeout = setTimeout(() => {
  console.error("FAIL: timed out after 45 seconds");
  process.exit(1);
}, 45_000);
const subscriptions: EventSubscription[] = [];
async function firstEvent<T>(subscription: EventSubscription<T>) {
  for await (const event of subscription) return event;
  throw new Error("Subscription ended before receiving an event");
}
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      authProvider: { token: async () => session?.token ?? getToken() },
    }),
  );
  const { events: types } = await events.list();
  assert.deepEqual(
    types.map((type) => [type.name, type.delivery]),
    [["flight.status_changed", ["poll", "push", "webhook"]]],
  );
  const tools = await client.listTools();
  const view = tools.tools.find((tool) => tool.name === "get_flight");
  assert.equal(
    (view?._meta?.ui as { resourceUri: string }).resourceUri,
    "ui://mcpjam-flights/trip.html",
  );
  const resource = await client.readResource({
    uri: "ui://mcpjam-flights/trip.html",
  });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.ok(
    "text" in resource.contents[0] &&
      resource.contents[0].text.includes("Your flight"),
  );
  await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "on_time" },
  });
  for (const delivery of ["poll", "push", "webhook"] as const) {
    subscriptions.push(
      await events.subscribe({
        name: "flight.status_changed",
        delivery,
        arguments: { flightId: "MJ204" },
      }),
    );
  }
  const iterators = subscriptions.map((sub) => sub[Symbol.asyncIterator]());
  // Another flight must not wake any of the MJ204 subscriptions.
  await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ318", status: "delayed", delayMinutes: 15 },
  });
  await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "delayed", delayMinutes: 45 },
  });
  const received = await Promise.all(
    iterators.map((iterator) => iterator.next()),
  );
  for (const item of received) {
    assert.equal(item.value.data.flight.flightId, "MJ204");
    assert.equal(item.value.data.flight.status, "delayed");
    assert.equal(item.value.data.flight.delayMinutes, 45);
    assert.equal(item.value.eventId, received[0].value.eventId);
  }
  const duplicate = await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "delayed", delayMinutes: 45 },
  });
  assert.equal(
    (duplicate.structuredContent as { emitted: boolean })?.emitted,
    false,
  );
  // Default watch ignores reset; the next event must be cancellation.
  await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "on_time" },
  });
  await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "cancelled" },
  });
  for (const item of await Promise.all(
    iterators.map((iterator) => iterator.next()),
  )) {
    assert.equal(item.value.data.flight.status, "cancelled");
    assert.equal(item.value.data.flight.estimatedDeparture, null);
  }
  const flight = await client.callTool({
    name: "get_flight",
    arguments: { flightId: "MJ204" },
  });
  assert.equal(
    (flight.structuredContent as { flight: { status: string } }).flight.status,
    "cancelled",
  );
  const invalid = await client.callTool({
    name: "simulate_flight_update",
    arguments: { flightId: "MJ204", status: "delayed" },
  });
  assert.equal(invalid.isError, true);
  console.log(
    "PASS: discovery + App resource; poll/push/webhook delay and cancellation delivery; flight filtering; reset exclusion; duplicate suppression; validation",
  );
} finally {
  await Promise.allSettled(subscriptions.map((sub) => sub.cancel()));
  await client.close();
  receiver.closeAllConnections();
  await new Promise<void>((resolve) => receiver.close(() => resolve()));
  clearTimeout(timeout);
}
