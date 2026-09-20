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
console.log("Cloudflare deployment bindings are ready.");
