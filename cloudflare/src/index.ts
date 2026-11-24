import { DurableObject } from "cloudflare:workers";
import {
  EventsError,
  type WebhookSubscriptionRecord,
  type WebhookSubscriptionStore,
} from "@modelcontextprotocol/server/ext/events";
import { createDemo, type DemoTrip } from "../../demo";
import {
  newTrip,
  readRpc,
  verifySessionToken,
  TRIP_ERROR,
} from "../../gateway";
import { cloudflareWebhookSender } from "./webhook-sender";
import { landing } from "./landing";
import type { Flight } from "../../flights";
import { changeSchema } from "../../flights";

interface Env {
  SESSIONS: DurableObjectNamespace<EventsDemoSession>;
  SESSION_LIMIT: RateLimit;
  REQUEST_LIMIT: RateLimit;
  DEMO_SESSION_SECRET: string;
}

class SubscriptionStore implements WebhookSubscriptionStore {
  constructor(private storage: DurableObjectStorage) {}
  get(id: string) {
    return this.storage.get<WebhookSubscriptionRecord>(`subscription:${id}`);
  }
  async put(record: WebhookSubscriptionRecord) {
    if (
      !(await this.get(record.id)) &&
      (await this.storage.list({ prefix: "subscription:", limit: 32 })).size >=
        32
    ) {
      throw new EventsError(
        "resourceExhausted",
        "This demo trip allows at most 32 webhook subscriptions.",
      );
    }
    await this.storage.put(`subscription:${record.id}`, record);
  }
  delete(id: string) {
    return this.storage.delete(`subscription:${id}`);
  }
  async *listByName(name: string) {
    const records = await this.storage.list<WebhookSubscriptionRecord>({
      prefix: "subscription:",
    });
    for (const record of records.values())
      if (record.name === name) yield record;
  }
}

export class EventsDemoSession extends DurableObject<Env> {
  private demo: ReturnType<typeof createDemo>;
  private expiresAt = 0;
  private tripId = "";
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.demo = createDemo(
      {
        getPrincipal: () => ctx.id.toString(),
        webhookSender: cloudflareWebhookSender,
        webhookStore: new SubscriptionStore(ctx.storage),
        webhookTtlMs: 60_000,
        maxSubscriptions: 128,
        emitBuffer: { maxEvents: 256, maxAgeMs: 5 * 60_000 },
        defaultNextPollMs: 1000,
        checkIntervalMs: 1000,
      },
      {
        load: () => ctx.storage.get<Flight[]>("flights"),
        save: (flights) => ctx.storage.put("flights", flights),
      },
      {
        getTrip: () =>
          this.tripId
            ? { tripId: this.tripId, expiresAt: this.expiresAt }
            : undefined,
      },
    );
    ctx.blockConcurrencyWhile(async () => {
      this.expiresAt = (await ctx.storage.get<number>("expiresAt")) ?? 0;
    });
  }
  async fetch(request: Request) {
    this.tripId = request.headers.get("x-demo-trip-id") ?? "";
    if (!this.expiresAt) {
      this.expiresAt = Number(request.headers.get("x-demo-expires-at"));
      if (!Number.isFinite(this.expiresAt) || this.expiresAt <= Date.now())
        return new Response(TRIP_ERROR, { status: 410 });
      await this.ctx.storage.put("expiresAt", this.expiresAt);
      await this.ctx.storage.setAlarm(this.expiresAt);
    }
    if (Date.now() >= this.expiresAt)
      return new Response(TRIP_ERROR, { status: 410 });
    if (new URL(request.url).pathname === "/demo/flight") {
      if (request.method === "GET")
        return Response.json({
          tripId: this.tripId,
          expiresAt: this.expiresAt,
          flights: await this.demo.listFlights(),
        });
      if (request.method !== "POST")
        return new Response("Use GET or POST", { status: 405 });
      if (Number(request.headers.get("content-length") ?? 0) > 4096)
        return new Response("Request too large", { status: 413 });
      try {
        const body = await request.text();
        if (body.length > 4096)
          return new Response("Request too large", { status: 413 });
        const { tripId: _tripId, ...change } = JSON.parse(body);
        const parsed = changeSchema.safeParse(change);
        if (!parsed.success)
          return new Response("Invalid flight update", { status: 400 });
        return Response.json(await this.demo.simulate(parsed.data));
      } catch (error) {
        if (error instanceof SyntaxError)
          return new Response("Invalid JSON", { status: 400 });
        return new Response(
          "Could not publish flight update. Refresh status before retrying.",
          { status: 500 },
        );
      }
    }
    return this.demo.handler.fetch(request);
  }
  async alarm() {
    if (Date.now() >= this.expiresAt) {
      await this.demo.stop();
      await this.demo.handler.close();
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(this.expiresAt);
  }
}

function cors(response: Response) {
  const result = new Response(response.body, response);
  result.headers.set("Access-Control-Allow-Origin", "*");
  result.headers.set(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
  );
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Content-Type-Options", "nosniff");
  return result;
}
async function routeTrip(request: Request, env: Env, trip: DemoTrip) {
  const session = await verifySessionToken(
    env.DEMO_SESSION_SECRET,
    trip.tripId,
  );
  if (!session) return new Response(TRIP_ERROR, { status: 410 });
  if (!(await env.REQUEST_LIMIT.limit({ key: session.id })).success)
    return new Response("Trip request limit exceeded.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  const headers = new Headers(request.headers);
  headers.set("x-demo-trip-id", trip.tripId);
  headers.set("x-demo-expires-at", String(session.expiresAt));
  return env.SESSIONS.get(env.SESSIONS.idFromName(session.id)).fetch(
    new Request(request, { headers }),
  );
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return cors(
        new Response(null, {
          headers: {
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              request.headers.get("Access-Control-Request-Headers") ??
              "Content-Type",
          },
        }),
      );
    if (url.pathname === "/" && request.method === "GET") return landing();
    if (url.pathname === "/health")
      return cors(
        Response.json({
          ok: true,
          authentication: "none",
          sdkCommit: "5ebb589b970bfc8f98e344e13299f8eb76ff8cd1",
        }),
      );
    if (!["/mcp", "/trips", "/demo/flight"].includes(url.pathname))
      return new Response("Not found", { status: 404 });
    if (!env.DEMO_SESSION_SECRET || env.DEMO_SESSION_SECRET.length < 32)
      return cors(new Response("Demo is not configured", { status: 503 }));
    // Bound public catalog traffic too. No IP address becomes a trip identity.
    const ip = request.headers.get("cf-connecting-ip") ?? "local";
    if (!(await env.REQUEST_LIMIT.limit({ key: "public:" + ip })).success)
      return cors(
        new Response("Request limit exceeded", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );
    let inspected: Awaited<ReturnType<typeof readRpc>>;
    try {
      inspected = await readRpc(request);
    } catch {
      return cors(new Response("Request too large", { status: 413 }));
    }
    const { message } = inspected;
    request = inspected.request;
    const isCreation =
      url.pathname === "/trips" ||
      (message?.method === "tools/call" &&
        message.params?.name === "create_demo_trip");
    if (isCreation && !(await env.SESSION_LIMIT.limit({ key: ip })).success)
      return cors(
        new Response("Please wait a minute before creating another trip.", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );
    const createTrip = async () => {
      const trip = await newTrip(env.DEMO_SESSION_SECRET);
      const response = await routeTrip(
        new Request(new URL("/demo/flight", url)),
        env,
        trip,
      );
      if (!response.ok) throw new Error("Could not create demo trip");
      const state = (await response.json()) as { flights: Flight[] };
      return { ...trip, flight: state.flights[0] };
    };
    if (url.pathname === "/trips")
      return request.method === "POST"
        ? cors(Response.json(await createTrip()))
        : cors(new Response("Use POST", { status: 405 }));
    if (url.pathname === "/demo/flight") {
      let tripId = url.searchParams.get("tripId");
      if (request.method === "POST") {
        try {
          tripId =
            ((await request.clone().json()) as { tripId?: string }).tripId ??
            null;
        } catch {
          return cors(new Response("Invalid JSON", { status: 400 }));
        }
      }
      const trip =
        typeof tripId === "string"
          ? await verifySessionToken(env.DEMO_SESSION_SECRET, tripId)
          : null;
      if (!trip || !tripId)
        return cors(new Response(TRIP_ERROR, { status: 410 }));
      return cors(
        await routeTrip(request, env, { tripId, expiresAt: trip.expiresAt }),
      );
    }
    const tripId = message?.params?.arguments?.tripId;
    const trip =
      !isCreation && typeof tripId === "string"
        ? await verifySessionToken(env.DEMO_SESSION_SECRET, tripId)
        : null;
    if (trip && typeof tripId === "string")
      return cors(
        await routeTrip(request, env, { tripId, expiresAt: trip.expiresAt }),
      );
    // Public discovery, catalog, App resources and trip creation need no credentials.
    // Missing/expired trip handles reach SDK validation/tool errors, never an OAuth challenge.
    const catalog = createDemo(
      {
        getPrincipal: () => "catalog",
        webhookSender: cloudflareWebhookSender,
        webhookTtlMs: 60000,
      },
      undefined,
      { getTrip: () => undefined, createTrip },
    );
    try {
      return cors(await catalog.handler.fetch(request));
    } finally {
      await catalog.handler.close();
    }
  },
} satisfies ExportedHandler<Env>;
