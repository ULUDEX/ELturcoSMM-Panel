const baseUrl = (process.env.SITE_URL || "https://elturcosmm.com").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("ADMIN_PASSWORD is required for the Worker email smoke test.");

const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!loginResponse.ok) throw new Error(`Admin login returned HTTP ${loginResponse.status}.`);
const setCookie = loginResponse.headers.get("set-cookie") || "";
const cookie = setCookie.match(/elturco_admin=[^;,]+/)?.[0];
if (!cookie) throw new Error("Admin login did not issue its session cookie.");

const response = await fetch(`${baseUrl}/api/admin/operations`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ action: "smtp-test" }),
});
const result = await response.json();
if (!response.ok || result.sent !== true) {
  throw new Error(`Worker email test failed: ${result.reason || `HTTP_${response.status}`}`);
}
console.log("Cloudflare Worker sent the SMTP test email successfully.");
