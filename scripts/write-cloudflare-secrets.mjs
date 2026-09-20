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
if (process.env.SMM_PROVIDER_API_KEY?.trim()) {
  secrets.SMM_PROVIDER_API_KEY = process.env.SMM_PROVIDER_API_KEY.trim();
}
for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) {
  if (process.env[name]?.trim()) secrets[name] = process.env[name].trim();
}

await writeFile(
  ".cloudflare-secrets.json",
  `${JSON.stringify(secrets)}\n`,
  { mode: 0o600 },
);
