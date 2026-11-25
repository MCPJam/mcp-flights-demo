// Import this before anything that builds zod schemas. Zod checks whether eval
// is allowed with `new Function("")` when it builds its first object schema, and
// ext-apps builds schemas on import, before `new App()` turns jitless on. Under a
// strict MCP Apps CSP (no 'unsafe-eval'), that check is reported as a violation.
import { config } from "zod";

config({ jitless: true });
