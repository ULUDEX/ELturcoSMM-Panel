import { env } from "cloudflare:workers";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));

export function mailConfigured() {
  const bindings = env as any;
  return Boolean(String(bindings.RESEND_API_KEY || "").trim() && String(bindings.EMAIL_FROM || "").trim());
}

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html?: string }) {
  const bindings = env as any;
  const apiKey = String(bindings.RESEND_API_KEY || "").trim();
  const from = String(bindings.EMAIL_FROM || "").trim();
  if (!apiKey || !from) return { sent: false, configured: false };
  const text = input.text.slice(0, 12000);
  const html = input.html || `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#15202b">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject.slice(0, 180), text, html }),
    });
    if (!response.ok) console.error("transactional_email_failed", { status: response.status });
    return { sent: response.ok, configured: true };
  } catch (error) {
    console.error("transactional_email_failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return { sent: false, configured: true };
  }
}

export function siteBaseUrl() {
  const configured = String((env as any).SITE_URL || "").trim();
  return (configured || "https://elturcosmm.com").replace(/\/$/, "");
}
