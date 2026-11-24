import { createDemo, type DemoTrip } from "./demo.js";
import {
  createSessionToken,
  verifySessionToken,
} from "./cloudflare/src/session-token.js";

export const TRIP_ERROR =
  "Trip is missing, invalid, or expired. Call create_demo_trip to start a new 30-minute demo.";
// Read only enough of an RPC to select its isolated trip. The official SDK still
// parses/validates and executes every MCP method, including Events delivery.
export async function readRpc(request: Request) {
  if (request.method !== "POST") return { request, message: undefined };
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(bytes);
  let message:
    | {
        method?: string;
        params?: { name?: string; arguments?: Record<string, unknown> };
      }
    | undefined;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      message = parsed;
  } catch {}
  return { request: new Request(request, { body: text }), message };
}
export async function newTrip(secret: string): Promise<DemoTrip> {
  const { token, expiresAt } = await createSessionToken(secret);
  return { tripId: token, expiresAt };
}
export { verifySessionToken };
export type DemoInstance = ReturnType<typeof createDemo>;
