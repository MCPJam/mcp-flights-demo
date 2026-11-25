import * as z from "zod/v4";

export const flightIds = ["MJ204", "MJ318", "MJ208", "MJ322"] as const;
// rebook_flight moves a traveler to the later flight on the same route.
export const laterFlight = { MJ204: "MJ208", MJ318: "MJ322" } as const;
export const statusSchema = z.enum(["on_time", "delayed", "cancelled"]);
export const changeSchema = z.discriminatedUnion("status", [
  z
    .object({
      flightId: z.enum(flightIds),
      status: z.literal("delayed"),
      delayMinutes: z.number().int().min(1).max(1440),
    })
    .strict(),
  z
    .object({ flightId: z.enum(flightIds), status: z.literal("cancelled") })
    .strict(),
  z
    .object({ flightId: z.enum(flightIds), status: z.literal("on_time") })
    .strict(),
]);
export const flightSchema = z.object({
  flightId: z.enum(flightIds),
  airline: z.string(),
  origin: z.string(),
  originCity: z.string(),
  destination: z.string(),
  destinationCity: z.string(),
  originTimeZone: z.string(),
  destinationTimeZone: z.string(),
  scheduledDeparture: z.string(),
  scheduledArrival: z.string(),
  estimatedDeparture: z.string().nullable(),
  estimatedArrival: z.string().nullable(),
  status: statusSchema,
  delayMinutes: z.number().int(),
  revision: z.number().int(),
  updatedAt: z.string(),
  simulated: z.literal(true),
});
export type Flight = z.infer<typeof flightSchema>;
export type FlightChange = z.infer<typeof changeSchema>;
export interface FlightStore {
  load(): Promise<Flight[] | undefined>;
  save(flights: Flight[]): Promise<void>;
}
export function initialFlights(now = Date.now()): Flight[] {
  const day = new Date(now);
  day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCHours(16, 0, 0, 0);
  return (["MJ204", "MJ318"] as const).map((flightId, i) => {
    const departure = new Date(day.getTime() + i * 3600000).toISOString();
    const arrival = new Date(
      day.getTime() + (i ? 3.5 : 5.5) * 3600000,
    ).toISOString();
    return {
      flightId,
      airline: "MCPJam Airways",
      origin: i ? "LAX" : "SFO",
      originCity: i ? "Los Angeles" : "San Francisco",
      destination: i ? "SEA" : "JFK",
      destinationCity: i ? "Seattle" : "New York",
      originTimeZone: "America/Los_Angeles",
      destinationTimeZone: i ? "America/Los_Angeles" : "America/New_York",
      scheduledDeparture: departure,
      scheduledArrival: arrival,
      estimatedDeparture: departure,
      estimatedArrival: arrival,
      status: "on_time",
      delayMinutes: 0,
      revision: 0,
      updatedAt: new Date(now).toISOString(),
      simulated: true,
    };
  });
}
export function applyChange(
  previous: Flight,
  change: FlightChange,
  now = Date.now(),
): Flight {
  const delayMinutes = change.status === "delayed" ? change.delayMinutes : 0;
  return {
    ...previous,
    status: change.status,
    delayMinutes,
    revision: previous.revision + 1,
    updatedAt: new Date(now).toISOString(),
    estimatedDeparture:
      change.status === "cancelled"
        ? null
        : new Date(
            Date.parse(previous.scheduledDeparture) + delayMinutes * 60000,
          ).toISOString(),
    estimatedArrival:
      change.status === "cancelled"
        ? null
        : new Date(
            Date.parse(previous.scheduledArrival) + delayMinutes * 60000,
          ).toISOString(),
  };
}
export function laterFlightFor(original: Flight, now = Date.now()): Flight {
  const flightId =
    laterFlight[original.flightId as keyof typeof laterFlight];
  if (!flightId) throw new Error(`${original.flightId} has no later flight.`);
  const later = (iso: string) =>
    new Date(Date.parse(iso) + 2 * 3600000).toISOString();
  const departure = later(original.scheduledDeparture);
  const arrival = later(original.scheduledArrival);
  return {
    ...original,
    flightId,
    scheduledDeparture: departure,
    scheduledArrival: arrival,
    estimatedDeparture: departure,
    estimatedArrival: arrival,
    status: "on_time",
    delayMinutes: 0,
    revision: 0,
    updatedAt: new Date(now).toISOString(),
  };
}
// Airport-local times for the model: ISO UTC alone led agents to report 16:00Z as 4 PM Pacific.
export function localTimes(flight: Flight) {
  const at = (iso: string | null, timeZone: string) =>
    iso
      ? new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone,
          timeZoneName: "short",
        }).format(new Date(iso))
      : null;
  return {
    scheduledDeparture: at(flight.scheduledDeparture, flight.originTimeZone),
    estimatedDeparture: at(flight.estimatedDeparture, flight.originTimeZone),
    scheduledArrival: at(flight.scheduledArrival, flight.destinationTimeZone),
    estimatedArrival: at(flight.estimatedArrival, flight.destinationTimeZone),
  };
}
