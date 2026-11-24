import { DurableObject } from "cloudflare:workers";
import {
  EventsError,
  type WebhookSubscriptionRecord,
  type WebhookSubscriptionStore,
} from "@modelcontextprotocol/server/ext/events";
import { createDemo } from "../../demo";
import { createSessionToken, verifySessionToken } from "./session-token";
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
        "This demo session allows at most 32 webhook subscriptions.",
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
    );
    ctx.blockConcurrencyWhile(async () => {
      this.expiresAt = (await ctx.storage.get<number>("expiresAt")) ?? 0;
    });
  }
  async fetch(request: Request) {
    if (!this.expiresAt) {
      this.expiresAt = Number(request.headers.get("x-demo-expires-at"));
      if (!Number.isFinite(this.expiresAt) || this.expiresAt <= Date.now())
        return new Response("Expired session", { status: 401 });
      await this.ctx.storage.put("expiresAt", this.expiresAt);
      await this.ctx.storage.setAlarm(this.expiresAt);
    }
    if (Date.now() >= this.expiresAt)
      return new Response("Expired session", { status: 401 });
    if (new URL(request.url).pathname === "/demo/flight") {
      if (request.method === "GET")
        return Response.json({ flights: await this.demo.listFlights() });
      if (request.method !== "POST")
        return new Response("Use GET or POST", { status: 405 });
      if (Number(request.headers.get("content-length") ?? 0) > 4096)
        return new Response("Request too large", { status: 413 });
      try {
        const body = await request.text();
        if (body.length > 4096)
          return new Response("Request too large", { status: 413 });
        const parsed = changeSchema.safeParse(JSON.parse(body));
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
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, origin } = new URL(request.url);
    if (request.method === "OPTIONS")
      return cors(
        new Response(null, {
          headers: {
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              request.headers.get("Access-Control-Request-Headers") ??
              "Authorization, Content-Type",
          },
        }),
      );
    if (pathname === "/" && request.method === "GET") return landing();
    if (pathname === "/health")
      return cors(
        Response.json({
          ok: true,
          sdkCommit: "5ebb589b970bfc8f98e344e13299f8eb76ff8cd1",
        }),
      );
    if (
      pathname !== "/sessions" &&
      pathname !== "/mcp" &&
      pathname !== "/demo/flight"
    )
      return new Response("Not found", { status: 404 });
    if (!env.DEMO_SESSION_SECRET || env.DEMO_SESSION_SECRET.length < 32)
      return cors(new Response("Demo is not configured", { status: 503 }));
    if (pathname === "/sessions") {
      if (request.method !== "POST")
        return cors(new Response("Use POST", { status: 405 }));
      // Only session creation uses an IP limit; MCP requests are limited by session.
      const { success } = await env.SESSION_LIMIT.limit({
        key: request.headers.get("cf-connecting-ip") ?? "local",
      });
      if (!success)
        return cors(
          new Response(
            "Please wait a minute before creating another session.",
            { status: 429, headers: { "Retry-After": "60" } },
          ),
        );
      return cors(
        Response.json({
          ...(await createSessionToken(env.DEMO_SESSION_SECRET)),
          url: `${origin}/mcp`,
        }),
      );
    }
    const token =
      /^Bearer (.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1] ??
      "";
    const session = await verifySessionToken(env.DEMO_SESSION_SECRET, token);
    if (!session)
      return cors(
        new Response(
          "Create a new 30-minute demo session on the home page, then use its bearer token.",
          {
            status: 401,
            headers: { "WWW-Authenticate": 'Bearer realm="MCP Events Demo"' },
          },
        ),
      );
    if (!(await env.REQUEST_LIMIT.limit({ key: session.id })).success)
      return cors(
        new Response("Session request limit exceeded.", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );
    const headers = new Headers(request.headers);
    headers.set("x-demo-expires-at", String(session.expiresAt));
    const object = env.SESSIONS.get(env.SESSIONS.idFromName(session.id));
    return cors(await object.fetch(new Request(request, { headers })));
  },
} satisfies ExportedHandler<Env>;
