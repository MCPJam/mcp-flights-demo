import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import {
  EventsExtension,
  EventsError,
  type EventsOptions,
} from "@modelcontextprotocol/server/ext/events";
import * as z from "zod/v4";
import {
  applyChange,
  changeSchema,
  flightIds,
  flightSchema,
  initialFlights,
  statusSchema,
  type Flight,
  type FlightStore,
} from "./flights.js";
import { flightAppHtml } from "./flight-app/dist/html.js";

export const APP_URI = "ui://mcpjam-flights/trip.html";
const MIME = "text/html;profile=mcp-app";
export function createDemo(options: EventsOptions, store?: FlightStore) {
  const events = new EventsExtension(options);
  let flights: Flight[];
  const ready = (async () => {
    flights = (await store?.load()) ?? initialFlights();
    await store?.save(flights);
  })();
  let queue: Promise<unknown> = ready;
  const changed = events.registerEvent("flight.status_changed", {
    emitOnly: true,
    description:
      "A simulated flight was delayed, cancelled, or restored. Subscribe for one flightId. By default only delays and cancellations are delivered. Ask the host to create an event subscription and an agent trigger; calling get_flight alone does not start monitoring.",
    inputSchema: z.object({
      flightId: z.enum(flightIds),
      statuses: z
        .array(statusSchema)
        .min(1)
        .optional()
        .describe(
          "Defaults to delayed and cancelled. Include on_time to receive recovery updates.",
        ),
    }),
    payloadSchema: z.object({
      flight: flightSchema,
      previousStatus: statusSchema,
      message: z.string(),
    }),
    match: (_ctx, event, args) =>
      event.data.flight.flightId === args.flightId &&
      (args.statuses ?? ["delayed", "cancelled"]).includes(
        event.data.flight.status,
      ),
  });
  async function listFlights() {
    await ready;
    return structuredClone(flights);
  }
  async function getFlight(flightId: string) {
    await ready;
    const flight = flights.find((f) => f.flightId === flightId);
    if (!flight) throw new Error("Unknown flight");
    return structuredClone(flight);
  }
  function simulate(input: unknown) {
    const change = changeSchema.parse(input);
    const result = queue.then(async () => {
      const previous = await getFlight(change.flightId);
      const delay = change.status === "delayed" ? change.delayMinutes : 0;
      if (previous.status === change.status && previous.delayMinutes === delay)
        return { flight: previous, emitted: false };
      const flight = applyChange(previous, change);
      const next = flights.map((f) =>
        f.flightId === flight.flightId ? flight : f,
      );
      await store?.save(next);
      flights = next;
      const eventId = crypto.randomUUID();
      const message =
        flight.status === "cancelled"
          ? `${flight.flightId} has been cancelled.`
          : flight.status === "delayed"
            ? `${flight.flightId} is delayed by ${flight.delayMinutes} minutes. New departure: ${flight.estimatedDeparture}.`
            : `${flight.flightId} is back on time.`;
      await changed.emit({
        eventId,
        timestamp: flight.updatedAt,
        data: { flight, previousStatus: previous.status, message },
      });
      return { flight, emitted: true, eventId };
    });
    queue = result.catch(() => {});
    return result;
  }
  function buildServer() {
    const server = new McpServer(
      { name: "MCPJam Flights", version: "1.0.0" },
      {
        extensions: [events],
        jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
      },
    );
    server.registerTool(
      "list_flights",
      {
        title: "Find your demo flight",
        description:
          "List the fictional flights in this isolated demo session. No real bookings or passenger data.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => {
        const data = { flights: await listFlights() };
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      },
    );
    server.registerTool(
      "get_flight",
      {
        title: "View flight status",
        description:
          "Show the live MCP App trip card for a fictional flight. This reads status; it does NOT subscribe or promise alerts. To watch it, the HOST must subscribe to flight.status_changed with this flightId and arrange agent execution. Use the user's standing instruction as the trigger, e.g. 'Let me know if my flight is cancelled or delayed.'",
        inputSchema: z.object({ flightId: z.enum(flightIds) }),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: { ui: { resourceUri: APP_URI }, "ui/resourceUri": APP_URI },
      },
      async ({ flightId }) => {
        const data = { flight: await getFlight(flightId) };
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      },
    );
    // App metadata links the official base SDK tool and resource. UI transport is the official Apps SDK.
    server.registerResource(
      "Flight status",
      APP_URI,
      { mimeType: MIME },
      async () => ({
        contents: [
          {
            uri: APP_URI,
            mimeType: MIME,
            text: flightAppHtml,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: { connectDomains: [], resourceDomains: [] },
              },
            },
          },
        ],
      }),
    );
    server.registerTool(
      "simulate_flight_update",
      {
        title: "Simulate a flight update",
        description:
          "PRESENTER/TEST TOOL ONLY. Change fictional flight status and publish an MCP Event. Never call this to check a flight, start monitoring, or fulfill an alert request. Call only when explicitly asked to simulate a delay, cancellation, or reset. delayMinutes is required only for delayed; omit otherwise.",
        inputSchema: z.object({
          flightId: z.enum(flightIds),
          status: statusSchema,
          delayMinutes: z.number().int().min(1).max(1440).optional(),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (input) => {
        const parsed = changeSchema.safeParse(input);
        if (!parsed.success)
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "For delayed, provide delayMinutes (1–1440). For cancelled or on_time, omit delayMinutes.",
              },
            ],
          };
        const data = await simulate(parsed.data);
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      },
    );
    return server;
  }
  return {
    handler: createMcpHandler(buildServer, { maxRequestBodySize: 65_536 }),
    listFlights,
    getFlight,
    simulate,
    async stop() {
      await changed.terminate(
        new EventsError(
          "forbidden",
          "Demo session expired. Create a new session to continue.",
        ),
      );
    },
  };
}
