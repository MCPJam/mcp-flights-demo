// One server for every Events client.
//
// The SDK implements the Beta Events extension. It advertises the extension under
// `capabilities.extensions["io.modelcontextprotocol/events"]` from `server/discover`, and
// serves events/* only on 2026-07-28. Clients built on the Events design sketch, ChatGPT
// among them, differ in two ways:
// - they look for a top-level `capabilities.events`;
// - they may call events/* inside an `initialize` (2025-era) session.
//   https://developers.openai.com/plugins/build/mcp-events
// Both documents define events/list, events/subscribe and events/unsubscribe with the same
// params and results. So this adapter changes only the envelope: it advertises both
// capability shapes, and it hands a 2025-era events/* request to the SDK in its 2026-07-28
// form. The SDK still validates and runs every request.

export type Rpc =
  | {
      jsonrpc?: string;
      id?: unknown;
      method?: string;
      params?: Record<string, unknown>;
    }
  | undefined;

const MODERN = "2026-07-28";
const META = "io.modelcontextprotocol/";

// A 2025-era session sends no per-request protocol version in `_meta`.
export function isLegacyEventsRequest(message: Rpc): boolean {
  if (typeof message?.method !== "string" || !message.method.startsWith("events/"))
    return false;
  const meta = message.params?._meta;
  return !(meta && typeof meta === "object" && `${META}protocolVersion` in meta);
}

export function toModernEventsRequest(request: Request, message: NonNullable<Rpc>): Request {
  const params = { ...(message.params ?? {}) };
  const meta = (params._meta && typeof params._meta === "object" ? params._meta : {}) as Record<string, unknown>;
  params._meta = {
    ...meta,
    [`${META}protocolVersion`]: MODERN,
    [`${META}clientCapabilities`]: {},
    [`${META}clientInfo`]: { name: "initialize-session", version: "0" },
  };
  const headers = new Headers(request.headers);
  headers.set("mcp-protocol-version", MODERN);
  headers.set("mcp-method", String(message.method));
  if (typeof params.name === "string") headers.set("mcp-name", params.name);
  headers.delete("mcp-session-id");
  headers.delete("content-length");
  return new Request(request, { headers, body: JSON.stringify({ ...message, params }) });
}

// Adds a top-level `events` capability next to whatever the SDK returned.
function withEventsCapability(message: unknown): boolean {
  const caps = (message as { result?: { capabilities?: Record<string, unknown> } })?.result?.capabilities;
  if (!caps || typeof caps !== "object") return false;
  if (!caps.events) caps.events = {};
  return true;
}

export async function advertiseEvents(response: Response): Promise<Response> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !(type.includes("json") || type.includes("event-stream"))) return response;
  const text = await response.text();
  let body = text;
  if (type.includes("event-stream")) {
    body = text
      .split("\n")
      .map((line) => {
        if (!line.startsWith("data:")) return line;
        try {
          const message = JSON.parse(line.slice(5));
          return withEventsCapability(message) ? `data: ${JSON.stringify(message)}` : line;
        } catch {
          return line;
        }
      })
      .join("\n");
  } else {
    try {
      const message = JSON.parse(text);
      if (withEventsCapability(message)) body = JSON.stringify(message);
    } catch {}
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

// The request to hand the SDK, and how to finish its response.
export function eventsCompat(request: Request, message: Rpc) {
  const legacyEvents = isLegacyEventsRequest(message);
  const method = message?.method;
  return {
    legacyEvents,
    request: legacyEvents ? toModernEventsRequest(request, message!) : request,
    finish: (response: Response) =>
      method === "initialize" || method === "server/discover"
        ? advertiseEvents(response)
        : Promise.resolve(response),
  };
}

// A log line with nothing secret in it: no webhook secret, callback path or full trip handle.
export function describeRpc(message: Rpc, legacyEvents: boolean) {
  const params = message?.params ?? {};
  const meta = params._meta as Record<string, unknown> | undefined;
  const args = params.arguments as Record<string, unknown> | undefined;
  const delivery = params.delivery as { mode?: unknown; url?: unknown } | undefined;
  let callback: string | undefined;
  if (typeof delivery?.url === "string")
    try {
      callback = new URL(delivery.url).origin;
    } catch {
      callback = "invalid";
    }
  return {
    rpc: message?.method,
    session: legacyEvents || !meta ? "initialize" : "2026-07-28",
    protocolVersion: (params.protocolVersion as string | undefined) ?? meta?.[`${META}protocolVersion`],
    client: (params.clientInfo as { name?: string } | undefined)?.name,
    event: typeof params.name === "string" ? params.name : undefined,
    arguments: args && {
      ...args,
      tripId: typeof args.tripId === "string" ? `${args.tripId.slice(0, 8)}…` : args.tripId,
    },
    delivery: delivery && { mode: delivery.mode, callback },
    cursor: params.cursor,
    ttlMs: params.ttlMs,
  };
}

// The shape of a reply for the log: capabilities, event names, or the error. Never payloads.
export function summarizeReply(text: string) {
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  let message: { result?: Record<string, unknown>; error?: { code?: number; message?: string } };
  try {
    message = JSON.parse(line ? line.slice(5) : text);
  } catch {
    return text.slice(0, 120);
  }
  if (message.error) return { error: message.error.code, message: message.error.message };
  const result = message.result ?? {};
  if (Array.isArray(result.events))
    return {
      events: (result.events as { name?: string; delivery?: unknown }[]).map((e) => ({ name: e.name, delivery: e.delivery })),
    };
  if (result.capabilities) return { protocolVersion: result.protocolVersion, capabilities: result.capabilities };
  const { id, refreshBefore, cursor, truncated, deliveryStatus } = result as Record<string, unknown>;
  return { keys: Object.keys(result), id, refreshBefore, cursor, truncated, deliveryStatus };
}
