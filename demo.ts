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
  laterFlightFor,
  localTimes,
  statusSchema,
  type Flight,
  type FlightStore,
} from "./flights.js";
import { flightAppHtml } from "./flight-app/dist/html.js";

export const APP_URI = "ui://mcpjam-flights/trip.html";
export interface DemoTrip {
  tripId: string;
  expiresAt: number;
}
export interface TripContext {
  getTrip(): DemoTrip | undefined;
  createTrip?: () => Promise<DemoTrip & { flight: Flight }>;
}
const tripIdSchema = z
  .string()
  .min(1)
  .max(200)
  .describe(
    "The tripId returned by create_demo_trip. Reuse it for every tool call and event subscription for this trip.",
  );
const MIME = "text/html;profile=mcp-app";
// The host, not the model, creates event subscriptions. Most hosts (MCPJam's
// Playground included) give the model no tool for it, so say what to do instead.
const ALERTS =
  "For alerts, use an events-subscription tool only if you have one (event flight.status_changed with this tripId and flightId). Otherwise tell the user to connect flight.status_changed with this tripId in their host, e.g. MCPJam: Playground → Events → Connect event, and add their alert instruction there. Never say alerts or monitoring are set up unless a subscription was actually created.";
export function createDemo(
  options: EventsOptions,
  store?: FlightStore,
  context?: TripContext,
) {
  const tripData = () => context?.getTrip();
  const assertTrip = (tripId: string) => {
    const trip = tripData();
    if (!trip || trip.tripId !== tripId || trip.expiresAt <= Date.now())
      throw new EventsError(
        "forbidden",
        "Trip is missing, invalid, or expired. Call create_demo_trip to start a new 30-minute demo.",
      );
  };
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
      "A simulated flight was delayed, cancelled, or restored. Subscribe using the tripId from create_demo_trip and one flightId. By default only delays and cancellations are delivered. Ask the host to create an event subscription and an agent trigger; calling get_flight alone does not start monitoring.",
    inputSchema: z.object({
      tripId: tripIdSchema,
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
      tripId: z.string(),
      flight: flightSchema,
      previousStatus: statusSchema,
      message: z.string(),
    }),
    onSubscribe: (_ctx, args) => assertTrip(args.tripId),
    match: (_ctx, event, args) =>
      event.data.tripId === args.tripId &&
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
        return { ...tripData(), flight: previous, emitted: false };
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
            ? `${flight.flightId} is delayed by ${flight.delayMinutes} minutes. New departure: ${localTimes(flight).estimatedDeparture}.`
            : `${flight.flightId} is back on time.`;
      await changed.emit({
        eventId,
        timestamp: flight.updatedAt,
        data: {
          tripId: tripData()?.tripId ?? "unit-test",
          flight,
          previousStatus: previous.status,
          message,
        },
      });
      return { ...tripData(), flight, emitted: true, eventId };
    });
    queue = result.catch(() => {});
    return result;
  }
  function rebook(flightId: string) {
    const result = queue.then(async () => {
      const original = await getFlight(flightId);
      if (original.status === "on_time")
        throw new Error(
          `${flightId} is on time. Rebooking is only for delayed or cancelled flights.`,
        );
      const candidate = laterFlightFor(original);
      const booked = flights.find((f) => f.flightId === candidate.flightId);
      if (!booked) {
        const next = [...flights, candidate];
        await store?.save(next);
        flights = next;
      }
      const flight = structuredClone(booked ?? candidate);
      return {
        ...tripData(),
        rebookedFrom: flightId,
        flight,
        localTimes: localTimes(flight),
      };
    });
    queue = result.catch(() => {});
    return result;
  }
  function buildServer() {
    const server = new McpServer(
      { name: "MCPJam Flights", version: "1.1.0" },
      {
        extensions: [events],
        jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
      },
    );
    server.registerTool(
      "create_demo_trip",
      {
        title: "Create a demo trip",
        description:
          `Start here when the user asks about their flight and has no tripId yet. Creates an isolated fictional trip, valid for 30 minutes, without login or credentials, and already shows its flight card (MCP App), so don't call get_flight afterwards for the same flight. Reuse the returned tripId for later tool calls and event subscriptions. Do not create another trip if a valid tripId is already available. Creating a trip does not start monitoring. ${ALERTS}`,
        inputSchema: z.object({}),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        _meta: { ui: { resourceUri: APP_URI }, "ui/resourceUri": APP_URI },
      },
      async () => {
        if (!context?.createTrip)
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Use create_demo_trip on the public /mcp endpoint.",
              },
            ],
          };
        const trip = await context.createTrip();
        const data = {
          ...trip,
          localTimes: localTimes(trip.flight),
          subscription: {
            name: "flight.status_changed",
            arguments: { tripId: trip.tripId, flightId: trip.flight.flightId },
          },
          monitoring: `Not started. ${ALERTS}`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      },
    );
    server.registerTool(
      "list_flights",
      {
        title: "Find your demo flight",
        description:
          "List the fictional flights in this isolated demo trip. No real bookings or passenger data.",
        inputSchema: z.object({ tripId: tripIdSchema }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ tripId }) => {
        assertTrip(tripId);
        const data = { ...tripData(), flights: await listFlights() };
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
          `Show the MCP App flight card with a fictional flight's current status, e.g. after an event or when the user asks again. create_demo_trip and rebook_flight already show the card, so don't call this right after them for the same flight. Reading status does not subscribe. ${ALERTS}`,
        inputSchema: z.object({
          tripId: tripIdSchema,
          flightId: z.enum(flightIds),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: { ui: { resourceUri: APP_URI }, "ui/resourceUri": APP_URI },
      },
      async ({ tripId, flightId }) => {
        assertTrip(tripId);
        const flight = await getFlight(flightId);
        const data = { ...tripData(), flight, localTimes: localTimes(flight) };
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
          tripId: tripIdSchema,
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
        const { tripId, ...change } = input;
        assertTrip(tripId);
        const parsed = changeSchema.safeParse(change);
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
    server.registerTool(
      "rebook_flight",
      {
        title: "Rebook a flight",
        description:
          "Move the traveler from a delayed or cancelled flight to the later MCPJam Airways flight on the same route, which departs two hours after the original schedule, and show the new flight's card (MCP App), so don't call get_flight afterwards. Fictional: no payment or real reservation. Only call it when the user asked to be rebooked.",
        inputSchema: z.object({
          tripId: tripIdSchema,
          flightId: z.enum(flightIds),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        _meta: { ui: { resourceUri: APP_URI }, "ui/resourceUri": APP_URI },
      },
      async ({ tripId, flightId }) => {
        assertTrip(tripId);
        try {
          const data = await rebook(flightId);
          return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  error instanceof Error ? error.message : "Could not rebook.",
              },
            ],
          };
        }
      },
    );
    return server;
  }
  return {
    handler: createMcpHandler(buildServer, { maxRequestBodySize: 65_536 }),
    listFlights,
    getFlight,
    simulate,
    rebook,
    async stop() {
      await changed.terminate(
        new EventsError(
          "forbidden",
          "Demo trip expired. Call create_demo_trip to continue.",
        ),
      );
    },
  };
}
