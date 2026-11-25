import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advertiseEvents,
  describeRpc,
  eventsCompat,
  isLegacyEventsRequest,
} from "../compat.ts";

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": { name: "beta", version: "1" },
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://flights.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("only events/* without a 2026 _meta counts as a legacy-session Events call", () => {
  assert.equal(isLegacyEventsRequest({ method: "events/list", params: {} }), true);
  assert.equal(isLegacyEventsRequest({ method: "events/subscribe" }), true);
  assert.equal(isLegacyEventsRequest({ method: "events/list", params: { _meta: MODERN_META } }), false);
  assert.equal(isLegacyEventsRequest({ method: "tools/call", params: {} }), false);
  assert.equal(isLegacyEventsRequest(undefined), false);
});

test("a legacy events/subscribe reaches the SDK in its 2026-07-28 form, params intact", async () => {
  const message = {
    jsonrpc: "2.0",
    id: 7,
    method: "events/subscribe",
    params: {
      name: "flight.status_changed",
      arguments: { tripId: "t", flightId: "MJ204" },
      delivery: { mode: "webhook", url: "https://hooks.example/x", secret: "whsec_abc" },
      ttlMs: 60000,
    },
  };
  const { request, legacyEvents } = eventsCompat(post(message, { "mcp-protocol-version": "2025-06-18", "mcp-session-id": "s" }), message);
  assert.equal(legacyEvents, true);
  assert.equal(request.headers.get("mcp-protocol-version"), "2026-07-28");
  assert.equal(request.headers.get("mcp-method"), "events/subscribe");
  assert.equal(request.headers.get("mcp-name"), "flight.status_changed");
  assert.equal(request.headers.get("mcp-session-id"), null);
  const body = await request.json();
  assert.equal(body.id, 7);
  assert.deepEqual(body.params.arguments, message.params.arguments);
  assert.deepEqual(body.params.delivery, message.params.delivery);
  assert.equal(body.params._meta["io.modelcontextprotocol/protocolVersion"], "2026-07-28");
});

test("a 2026 request passes through untouched", () => {
  const message = { jsonrpc: "2.0", id: 1, method: "events/list", params: { _meta: MODERN_META } };
  const original = post(message);
  assert.equal(eventsCompat(original, message).request, original);
});

test("initialize and server/discover replies gain a top-level events capability, JSON or SSE", async () => {
  const result = { protocolVersion: "2025-03-26", capabilities: { tools: {} } };
  const json = await advertiseEvents(
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "content-type": "application/json" } }),
  );
  assert.deepEqual((await json.json()).result.capabilities, { tools: {}, events: {} });
  const sse = await advertiseEvents(
    new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result })}\n\n`, {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  const line = (await sse.text()).split("\n").find((l) => l.startsWith("data:"))!;
  assert.deepEqual(JSON.parse(line.slice(5)).result.capabilities, { tools: {}, events: {} });
  const discover = await advertiseEvents(
    Response.json({ jsonrpc: "2.0", id: 2, result: { capabilities: { extensions: { "io.modelcontextprotocol/events": {} } } } }),
  );
  assert.deepEqual((await discover.json()).result.capabilities, {
    extensions: { "io.modelcontextprotocol/events": {} },
    events: {},
  });
});

test("other replies are left alone", async () => {
  const message = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const reply = new Response("{}", { headers: { "content-type": "application/json" } });
  assert.equal(await eventsCompat(post(message), message).finish(reply), reply);
});

test("the log line carries no secret, callback path or full trip handle", () => {
  const line = JSON.stringify(
    describeRpc(
      {
        method: "events/subscribe",
        params: {
          name: "flight.status_changed",
          arguments: { tripId: "abcdefghijklmnop.signed", flightId: "MJ204" },
          delivery: { mode: "webhook", url: "https://hooks.example/private/path?token=x", secret: "whsec_secret" },
        },
      },
      true,
    ),
  );
  assert.doesNotMatch(line, /whsec_|private\/path|token=|ijklmnop/);
  assert.match(line, /https:\/\/hooks\.example/);
});
