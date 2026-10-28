import { readFile, writeFile } from "node:fs/promises";

const configPath = "dist/server/wrangler.json";
const required = [
  "CF_D1_DATABASE_ID",
  "CF_D1_DATABASE_NAME",
  "CF_R2_BUCKET_NAME",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing GitHub Actions variables: ${missing.join(", ")}`,
  );
}

const config = JSON.parse(await readFile(configPath, "utf8"));
const apiVersion = process.env.SMM_PROVIDER_API_VERSION?.trim() || "3";
if (!["2", "3"].includes(apiVersion)) throw new Error("SMM_PROVIDER_API_VERSION must be 2 or 3.");
config.vars = { ...config.vars, SMM_PROVIDER_API_VERSION: apiVersion };
config.ai = { binding: "AI" };
config.name = process.env.CF_WORKER_NAME?.trim() || "elturko-smm";
// The production custom domains are already attached to this Worker. The
// deployment token only needs account-level Worker access, so leave zone route
// management out of routine releases.
delete config.routes;

const d1 = config.d1_databases?.find((item) => item.binding === "DB");
if (!d1) throw new Error("Build output is missing the DB binding.");
d1.database_id = process.env.CF_D1_DATABASE_ID.trim();
d1.database_name = process.env.CF_D1_DATABASE_NAME.trim();
d1.migrations_dir = "../../drizzle";

const r2 = config.r2_buckets?.find((item) => item.binding === "MEDIA");
if (!r2) throw new Error("Build output is missing the MEDIA binding.");
r2.bucket_name = process.env.CF_R2_BUCKET_NAME.trim();

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

// Cloudflare's edge currently returns invalid Brotli streams for the public
// storefront assets. Prevent transformations for these files until that is
// resolved; the browser can then load the original CSS and JavaScript.
const headersPath = "dist/client/_headers";
const storefrontCacheControl = "public, max-age=31536000, immutable, no-transform";
let headers = "";
try {
  headers = await readFile(headersPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const lines = headers.split(/\r?\n/);
for (const route of ["/site/*.css", "/site/*.js"]) {
  const routeIndex = lines.findIndex((line) => line.trim() === route);
  if (routeIndex === -1) {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push(route, `  Cache-Control: ${storefrontCacheControl}`);
    continue;
  }
  let headerIndex = routeIndex + 1;
  while (headerIndex < lines.length && !lines[headerIndex].trim()) headerIndex += 1;
  if (headerIndex < lines.length && /^\s+Cache-Control:/i.test(lines[headerIndex])) {
    lines[headerIndex] = `  Cache-Control: ${storefrontCacheControl}`;
  } else {
    lines.splice(routeIndex + 1, 0, `  Cache-Control: ${storefrontCacheControl}`);
  }
}
const nextHeaders = `${lines.join("\n").trimEnd()}\n`;
if (nextHeaders !== headers) await writeFile(headersPath, nextHeaders);
console.log("Cloudflare deployment bindings are ready.");
