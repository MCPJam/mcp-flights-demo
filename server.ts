import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { nodeWebhookSender } from "@modelcontextprotocol/server/ext/events/node";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createDemo, type DemoTrip } from "./demo.js";
import {
  newTrip,
  readRpc,
  verifySessionToken,
  type DemoInstance,
} from "./gateway.js";
import { port, receiverPort } from "./config.js";
const secret = randomBytes(48).toString("hex");
const trips = new Map<string, { trip: DemoTrip; demo: DemoInstance }>();
const options = {
  getPrincipal: () => "anonymous-trip",
  webhookSender: nodeWebhookSender(),
  webhookTtlMs: 60000,
  trustedOrigins: [`http://127.0.0.1:${receiverPort}`],
  checkIntervalMs: 250,
  defaultNextPollMs: 1000,
};
const catalog = createDemo(options, undefined, {
  getTrip: () => undefined,
  createTrip: async () => {
    if (trips.size >= 100)
      throw new Error(
        "Local demo trip limit reached. Wait for expiry or restart.",
      );
    const trip = await newTrip(secret);
    const demo = createDemo(options, undefined, { getTrip: () => trip });
    trips.set(trip.tripId, { trip, demo });
    return { ...trip, flight: await demo.getFlight("MJ204") };
  },
});
const cleanup = setInterval(() => {
  for (const [id, { trip, demo }] of trips)
    if (trip.expiresAt <= Date.now()) {
      trips.delete(id);
      void demo.stop().then(() => demo.handler.close());
    }
}, 1000);
cleanup.unref();
const mcp = toNodeHandler({
  async fetch(request) {
    let inspected: Awaited<ReturnType<typeof readRpc>>;
    try {
      inspected = await readRpc(request);
    } catch {
      return new Response("Request too large", { status: 413 });
    }
    const { message } = inspected;
    const id = message?.params?.arguments?.tripId;
    const valid =
      typeof id === "string" ? await verifySessionToken(secret, id) : null;
    const entry = valid && typeof id === "string" ? trips.get(id) : undefined;
    return (entry?.demo ?? catalog).handler.fetch(inspected.request);
  },
});
const http = createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, authentication: "none" }));
    return;
  }
  if (path !== "/mcp") {
    res.writeHead(404);
    res.end("MCP endpoint: /mcp");
    return;
  }
  void mcp(req, res);
});
http.listen(port, "127.0.0.1", () =>
  console.log(
    JSON.stringify({
      action: "ready",
      url: `http://127.0.0.1:${port}/mcp`,
      authentication: "none",
    }),
  ),
);
async function shutdown() {
  clearInterval(cleanup);
  await Promise.all(
    [...trips.values()].map(async ({ demo }) => {
      await demo.stop();
      await demo.handler.close();
    }),
  );
  await catalog.handler.close();
  http.closeAllConnections();
  http.close();
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
