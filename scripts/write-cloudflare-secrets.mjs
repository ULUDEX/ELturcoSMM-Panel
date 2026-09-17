import { writeFile } from "node:fs/promises";

const names = ["ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing GitHub Actions secrets: ${missing.join(", ")}`,
  );
}

const secrets = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
);

await writeFile(
  ".cloudflare-secrets.json",
  `${JSON.stringify(secrets)}\n`,
  { mode: 0o600 },
);
