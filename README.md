# MCPJam Flights

**“Show my flight MJ204, and let me know if it’s cancelled or delayed.”**

A shareable travel-plugin demo with fictional flights, real MCP Events, and an interactive MCP App. Built using the official TypeScript SDK's experimental Events implementation and the published MCP Apps SDK.

**[Open the demo](https://flights.mcpjam.com)** · MCP endpoint: **`https://flights.mcpjam.com/mcp`**

## Demo in 60 seconds

1. In MCPJam, add the HTTP server **`https://flights.mcpjam.com/mcp`** with **Authentication: None**. No website visit, account, or custom header is needed.
2. Ask **“Create a demo trip and let me know if my flight is cancelled or delayed.”** The agent calls `create_demo_trip`, gets a temporary `tripId`, and uses MCPJam's Events tools to subscribe to `flight.status_changed` and arrange the alert.
3. Ask **“Simulate a 45-minute delay for my trip.”** The agent calls `simulate_flight_update` using the same `tripId`. Check the event and agent response in MCPJam. Try cancellation next.
4. The MCP App displays the flight card and refreshes its status. For repeatable presentation controls, optionally open the demo website, expand **Presenter controls**, paste the agent's trip ID, and load it. Creating a different trip on the website will not update the agent's trip.

For manual setup, call `create_demo_trip`, subscribe in **Events** using its returned `subscription.arguments`, and enable a trigger: **“Let me know if MJ204 is cancelled or delayed. Include the new departure time for delays. Do not simulate changes or rebook.”** Choose a delivery mode supported by the selected host.

Trips contain fictional data and expire after 30 minutes. The host creates subscriptions and runs the agent; creating or reading a trip does not start monitoring. Hosts without conversational subscription/trigger tools need manual setup. Successful publication, receipt by the host, and an agent reply are separate observations. No real flights, reservations, purchases, or rebooking are involved.

## What the plugin exposes

| Interface                                | Purpose                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `create_demo_trip` tool                  | Create an isolated, 30-minute trip and return its `tripId`, initial flight, and subscription arguments |
| `list_flights` tool                      | Find the fictional flights in this trip: MJ204 (SFO → JFK), MJ318 (LAX → SEA)                          |
| `get_flight` tool                        | Read current status and render the MCP App                                                             |
| `simulate_flight_update` tool            | Presenter/test-only tool; must not be used to fulfill a monitoring request                             |
| `flight.status_changed` event            | Deliver status changes for one selected flight                                                         |
| `ui://mcpjam-flights/trip.html` resource | Bundled MCP App using the official Apps SDK                                                            |

All flight tools and event subscriptions require the `tripId` returned by `create_demo_trip`. Reuse it for the same trip; do not create a new trip for every call. Example subscription arguments:

```json
{ "tripId": "<returned tripId>", "flightId": "MJ204" }
```

By default, only **delayed** and **cancelled** changes match. To receive recovery events too:

```json
{
  "tripId": "<returned tripId>",
  "flightId": "MJ204",
  "statuses": ["delayed", "cancelled", "on_time"]
}
```

Each event contains `tripId`, `flight` (including scheduled/estimated times and revision), `previousStatus`, and `message`. All times on the wire are ISO UTC; the interface renders airport-local time. Delay minutes are relative to the **scheduled** departure, not cumulative. An identical update does not publish a duplicate. Updates for another flight or trip do not match the watch.

The App refreshes status through `get_flight` every five seconds while visible. It reuses the trip ID from the tool result through the host's tool connection and needs no direct network access. **App refresh is not MCP Events delivery.** The host receives MCP Events separately and runs the agent according to its trigger configuration.

The optional presenter page creates trips through `POST /trips`, reads them through `GET /demo/flight?tripId=...`, and simulates changes through `POST /demo/flight`. These route to the same isolated trip as MCP calls with that ID. Example POST body:

```json
{
  "tripId": "<returned tripId>",
  "flightId": "MJ204",
  "status": "delayed",
  "delayMinutes": 45
}
```

For `cancelled` or `on_time`, omit `delayMinutes`.

## SDK provenance

The official TypeScript SDK is a git submodule pinned to `5ebb589b970bfc8f98e344e13299f8eb76ff8cd1` from [`feature/ext-events-sep-3415`, PR #3209](https://github.com/modelcontextprotocol/typescript-sdk/pull/3209). This is experimental Events support, **not a stable npm Events release**. The server uses MCP `2026-07-28` and `capabilities.extensions["io.modelcontextprotocol/events"]`; it does not emulate the older top-level `capabilities.events` draft.

The SDK handles discovery, subscriptions, poll/push/webhook delivery, callback verification, signatures, leases, and retries. The UI uses published `@modelcontextprotocol/ext-apps` (exact version in `flight-app/package-lock.json`). The gateway reads the trip ID from RPC arguments to select its Durable Object; the official SDK validates and executes the original request. No application code reimplements either wire protocol.

## Local development

Requirements: Node 24, pnpm 10.26.1.

```sh
git clone --recurse-submodules https://github.com/MCPJam/mcp-flights-demo.git
cd mcp-flights-demo
npm run setup
npm --prefix cloudflare ci
```

The setup script builds the pinned SDK, links its dependencies at the root, and installs/builds the App in its own package. **Do not run `npm install` at the root.**

For the presenter website and isolated trips, create `cloudflare/.dev.vars` (gitignored) with a local random secret of at least 32 characters:

```text
DEMO_SESSION_SECRET=your-random-local-secret-at-least-32-characters
```

Then `npm --prefix cloudflare run dev` and visit `http://localhost:18891`.

For MCP-only local testing, run `npm start`. Connect to `http://127.0.0.1:18889/mcp` with Authentication set to None. Call `create_demo_trip` to begin. The Node server keeps up to 100 isolated trips in memory; restarting it invalidates them. The presenter page is served by the Cloudflare runtime.

| Variable               | Default             | Purpose                                |
| ---------------------- | ------------------- | -------------------------------------- |
| `PORT`                 | `18889`             | Local Node server                      |
| `EVENTS_RECEIVER_PORT` | `18890`             | Set on both Node server and smoke test |
| `WEBHOOK_URL`          | Local test receiver | Public HTTPS callback for hosted tests |

After editing `flight-app/src.ts` or `index.html`, run `npm --prefix flight-app run build`.

## Cloudflare deployment

Each trip runs in its own SQLite-backed Durable Object. Flight state and webhook subscriptions survive runtime restarts. An alarm terminates subscriptions and deletes trip storage at expiry. A trip ID is an unguessable, signed access handle, not an account identity: anyone holding it can view and simulate that fictional trip. IDs expire after 30 minutes; invalid or expired IDs return actionable tool errors without an OAuth challenge. Only use synthetic data. There is no login or connection-time authentication.

```sh
npm --prefix cloudflare run deploy
# From cloudflare/: npx wrangler secret put DEMO_SESSION_SECRET
```

Set a fresh production secret via Wrangler's secret prompt. Do not reuse your local secret or commit credentials. If forking, change the Worker name, custom domain, rate-limit namespace IDs, source link, and workflow production URL. Until the secret is configured, trip creation and MCP endpoints return 503.

**Limits:** SDK event replay is in memory (256 events / five minutes) and can reset on eviction/deployment. This is not a durable event queue or an exactly-once system. Flight state is saved before publication; an interruption between those operations can leave a changed status without a delivered event. Reconnect/resubscribe as needed and use `get_flight` to reconcile current status. Trip creation is limited to roughly 10/minute/IP, public requests to 300/minute/IP/location, trip requests to 300/minute/trip/location, and stored webhook subscriptions to 32/trip. UI polling stops when its page is hidden. These are demo bounds, not a global spend cap.

## CI and deployments

GitHub Actions builds both SDKs, typechecks both runtimes, runs unit checks, exercises all three delivery modes against Node, and tests the anonymous trip isolation and presenter-to-event path in the local Cloudflare runtime.

The production deployment job runs only after a verified push to `main`. Configure the repository's `production` environment with `CLOUDFLARE_API_TOKEN` (Workers deployment and domain route permissions) and variable `CLOUDFLARE_ACCOUNT_ID`. Restrict that environment to `main`, then set the repository variable `CLOUDFLARE_DEPLOY_ENABLED=true` to enable automatic deployments. The runtime session secret stays in Cloudflare. Pull requests do not deploy. A newly created repo needs its own deployment credentials; it does not inherit the original Events demo's secrets.

## Verification

```sh
npm run typecheck
npm --prefix cloudflare run check
npm run test:unit
npm --prefix cloudflare run build
npm test               # Node server running
npm run test:isolation # Local Cloudflare server running
```

To test all delivery modes against a hosted endpoint, expose the receiver with `cloudflared tunnel --url http://127.0.0.1:18890`, then run:

```sh
WEBHOOK_URL=https://YOUR-TUNNEL.trycloudflare.com/events npm run test:cloudflare -- https://flights.mcpjam.com/mcp
npm run test:isolation -- https://flights.mcpjam.com/mcp
```

These create disposable trips; they do not configure or prove a live MCPJam agent trigger. Close the test tunnel afterward.

## License

Demo: MIT. Based on [MCPJam's Events demo](https://github.com/MCPJam/mcp-events-demo). The official SDK submodule retains its Apache-2.0 license.
