import { build, transform } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const result = await build({
  entryPoints: ["src.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
const template = await readFile("index.html", "utf8");
const html = template.replace(
  "/* APP_SCRIPT */",
  () => result.outputFiles[0].text.replaceAll("</script", "<\\/script"),
);
// Validate the actual embedded script, including template escaping.
const embedded = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!embedded) throw new Error("Missing App script");
await transform(embedded, { loader: "js", format: "esm", target: "es2022" });
await mkdir("dist", { recursive: true });
await writeFile(
  "dist/html.js",
  "export const flightAppHtml = " + JSON.stringify(html) + ";\n",
);
await writeFile(
  "dist/html.d.ts",
  "export declare const flightAppHtml: string;\n",
);
