import { digest } from "@/lib/customer-auth";
import { env } from "cloudflare:workers";

export function turnstileConfigured() {
  const bindings = env as any;
  return Boolean(String(bindings.TURNSTILE_SITE_KEY || "").trim() && String(bindings.TURNSTILE_SECRET_KEY || "").trim());
}

export async function verifyAccountChallenge(request: Request, body: any) {
  const token = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
  if (turnstileConfigured()) {
    if (!token || token.length > 2048) return false;
    try {
      const form = new URLSearchParams({ secret: String((env as any).TURNSTILE_SECRET_KEY).trim(), response: token });
      const ip = request.headers.get("CF-Connecting-IP");
      if (ip) form.set("remoteip", ip);
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form, signal: AbortSignal.timeout(5000) });
      const result = await response.json() as { success?: boolean; hostname?: string };
      return response.ok && result.success === true && ["elturcosmm.com", "www.elturcosmm.com"].includes(String(result.hostname || "").toLowerCase());
    } catch { return false; }
  }
  return consumeAccountChallenge(body?.challengeId, body?.challengeAnswer);
}

export async function consumeAccountChallenge(idValue: unknown, answerValue: unknown) {
  const id = typeof idValue === "string" ? idValue : "";
  const answer = typeof answerValue === "string" ? answerValue.trim() : "";
  if (!/^[a-f0-9]{32}$/.test(id) || !/^\d{1,2}$/.test(answer)) return false;

  const row = await env.DB.prepare("DELETE FROM account_challenges WHERE id=? RETURNING answer_hash,expires_at").bind(id).first() as { answer_hash: string; expires_at: number } | null;
  if (!row || Number(row.expires_at) <= Math.floor(Date.now() / 1000)) return false;

  const expected = String(row.answer_hash);
  const actual = await digest(id + ":" + answer);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}
