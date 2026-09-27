import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const email = `deploy-smoke-${process.env.GITHUB_RUN_ID || Date.now()}@example.invalid`;
const salt = randomBytes(16).toString("hex");
const password = "DeployTest-9284";
const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
const now = Math.floor(Date.now() / 1000);
const config = "dist/server/wrangler.json";

function sql(command) {
  const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--remote", "--config", config, "--command", command], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error("D1 smoke-test operation failed");
}

const cleanup = () => sql(`DELETE FROM customer_sessions WHERE user_id IN (SELECT id FROM customer_users WHERE email='${email}'); DELETE FROM customer_email_verifications WHERE user_id IN (SELECT id FROM customer_users WHERE email='${email}'); DELETE FROM customer_balances WHERE email='${email}'; DELETE FROM customer_users WHERE email='${email}';`);

const challengeResponse = await fetch("https://elturcosmm.com/api/account/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
if (!challengeResponse.ok) throw new Error(`Challenge returned HTTP ${challengeResponse.status}`);
const challenge = await challengeResponse.json();
if (challenge.mode === "turnstile") {
  const loginResponse = await fetch("https://elturcosmm.com/api/account/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, turnstileToken: "invalid-deployment-smoke-token" }),
  });
  const login = await loginResponse.json();
  if (loginResponse.status !== 400 || !String(login.error || "").toLowerCase().includes("doğrulama")) {
    throw new Error(`Invalid Turnstile token was not rejected (HTTP ${loginResponse.status})`);
  }
  console.log("Turnstile is enabled and invalid verification tokens are rejected.");
  process.exit(0);
}

try {
  sql(`INSERT INTO customer_users(name,email,password_hash,password_salt,avatar,created_at,email_verified_at) VALUES('Deploy Test','${email}','pbkdf2-sha256$100000$${hash}','${salt}','man-1',${now},NULL); INSERT INTO customer_balances(email,balance,created_at,updated_at) VALUES('${email}',0,${now},${now});`);

  const numbers = challenge.question.match(/\d+/g)?.map(Number) || [];
  if (numbers.length !== 2) throw new Error("Could not read account challenge");

  const loginResponse = await fetch("https://elturcosmm.com/api/account/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, challengeId: challenge.id, challengeAnswer: String(numbers[0] + numbers[1]) }),
  });
  const login = await loginResponse.json();
  if (loginResponse.status !== 403 || !String(login.error).includes("henüz doğrulanmamış")) {
    throw new Error(`Unverified account login was not blocked (HTTP ${loginResponse.status})`);
  }

  const accountResponse = await fetch("https://elturcosmm.com/api/account");
  const account = await accountResponse.json();
  if (account.loggedIn) throw new Error("Unverified customer obtained an account session");
  console.log("Unverified account login is blocked and the public session endpoint stays logged out.");
} finally {
  cleanup();
}
