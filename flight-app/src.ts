import "./zod-jitless.js"; // must stay first: see the file
import { App } from "@modelcontextprotocol/ext-apps";
const app = new App({ name: "MCPJam Flights", version: "1.1.0" }, {});
const el = (id: string) => document.getElementById(id)!;
let tripId: string | undefined,
  flightId: string | undefined,
  timer: ReturnType<typeof setTimeout> | undefined,
  stopped = false,
  busy = false;
const time = (iso: string | null, zone: string) =>
  iso
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone,
      }).format(new Date(iso))
    : "—";
function render(result: any) {
  if (result.isError)
    throw new Error(
      "Flight status is unavailable. Your demo trip may have expired.",
    );
  const f = result.structuredContent?.flight;
  if (!f) return;
  tripId = result.structuredContent?.tripId;
  flightId = f.flightId;
  for (const key of ["origin", "originCity", "destination", "destinationCity"])
    el(key).textContent = f[key];
  el("title").textContent = "Your trip to " + f.destinationCity;
  el("date").textContent =
    f.flightId +
    " · " +
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: f.originTimeZone,
    }).format(new Date(f.scheduledDeparture));
  el("status").className = "status " + f.status;
  el("statusText").textContent =
    { on_time: "On time", delayed: "Delayed", cancelled: "Flight cancelled" }[
      f.status as string
    ] ?? f.status;
  el("delay").textContent =
    f.status === "delayed" ? "+" + f.delayMinutes + " min" : "";
  el("departure").textContent = time(f.estimatedDeparture, f.originTimeZone);
  el("arrival").textContent = time(f.estimatedArrival, f.destinationTimeZone);
  el("oldDeparture").textContent =
    f.status === "delayed" ? time(f.scheduledDeparture, f.originTimeZone) : "";
  el("oldArrival").textContent =
    f.status === "delayed"
      ? time(f.scheduledArrival, f.destinationTimeZone)
      : "";
  el("departureZone").textContent = f.origin + " local time";
  el("arrivalZone").textContent = f.destination + " local time";
  el("notice").textContent =
    f.status === "cancelled"
      ? "This simulated flight is no longer operating. No real booking has been changed."
      : "This card refreshes flight status. Agent alerts require a separate active Events subscription and trigger in your host.";
  el("updated").textContent = "Checked " + new Date().toLocaleTimeString();
  el("loading").hidden = true;
  el("trip").hidden = false;
  el("error").hidden = true;
}
async function refresh() {
  if (busy || !flightId || !tripId || stopped) return;
  busy = true;
  try {
    render(
      await app.callServerTool({
        name: "get_flight",
        arguments: { tripId, flightId },
      }),
    );
  } catch {
    el("error").textContent =
      "Could not refresh. Check the server connection and trip expiry.";
    el("error").hidden = false;
  } finally {
    busy = false;
  }
}
function schedule() {
  timer = setTimeout(async () => {
    if (!document.hidden) await refresh();
    if (!stopped) schedule();
  }, 5000);
}
app.ontoolresult = (result) => {
  try {
    render(result);
  } catch (error) {
    el("error").textContent = String(error);
    el("error").hidden = false;
  }
};
app.ontoolinput = ({ arguments: args }) => {
  if (typeof args?.tripId === "string") tripId = args.tripId;
  if (typeof args?.flightId === "string") flightId = args.flightId;
};
app.onteardown = async () => {
  stopped = true;
  clearTimeout(timer);
  return {};
};
el("refresh").addEventListener("click", refresh);
try {
  await app.connect();
  schedule();
} catch {
  el("loading").textContent =
    "Open this flight card in an MCP Apps-compatible host.";
}
