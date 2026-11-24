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
  const response = await fetch(new URL("/sessions", url), { method: "POST" });
  assert.equal(response.status, 200);
  const { token } = (await response.json()) as { token: string };
  const events = new EventsClientExtension();
  const client = new Client(
    { name: "isolation-test", version: "1" },
    {
      versionNegotiation: { mode: "auto" },
      extensions: [events],
    },
  );
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      authProvider: { token: async () => token },
    }),
  );
  return { client, events, token };
}
async function first(sub: EventSubscription) {
  for await (const event of sub) return event;
  throw new Error("No event");
}
try {
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  assert.equal(
    (
      await fetch(url, {
        headers: {
          Authorization: "Bearer forged",
          "x-demo-expires-at": "9999999999999",
        },
      })
    ).status,
    401,
  );
  const a = await connect();
  const b = await connect();
  assert.notEqual(a.token, b.token);
  const endpoint = new URL("/demo/flight", url);
  assert.equal((await fetch(endpoint)).status, 401);
  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  const post = (token: string, data: unknown) =>
    fetch(endpoint, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(data),
    });
  for (const session of [a, b])
    subscriptions.push(
      await session.events.subscribe({
        name: "flight.status_changed",
        delivery: "poll",
        arguments: { flightId: "MJ204" },
      }),
    );
  assert.equal(
    (
      await post(a.token, {
        flightId: "MJ204",
        status: "delayed",
        delayMinutes: 0,
      })
    ).status,
    400,
  );
  const invalid = await fetch(endpoint, {
    method: "POST",
    headers: headers(a.token),
    body: "{",
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    (
      await post(a.token, {
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
  const bState = (await fetch(endpoint, { headers: headers(b.token) }).then(
    (r) => r.json(),
  )) as { flights: Array<{ status: string }> };
  assert.equal(bState.flights[0].status, "on_time");
  assert.equal(
    (await post(b.token, { flightId: "MJ204", status: "cancelled" })).status,
    200,
  );
  assert.equal(
    ((await first(subscriptions[1])).data as { flight: { status: string } })
      .flight.status,
    "cancelled",
  );
  const aState = await a.client.callTool({
    name: "get_flight",
    arguments: { flightId: "MJ204" },
  });
  assert.equal(
    (aState.structuredContent as { flight: { status: string } }).flight.status,
    "delayed",
  );
  console.log(
    "PASS: auth rejection, invalid updates, isolated flight state, presenter REST → MCP Event → tool readback",
  );
} finally {
  await Promise.allSettled(subscriptions.map((sub) => sub.cancel()));
  await Promise.allSettled(clients.map((client) => client.close()));
  clearTimeout(deadline);
}
