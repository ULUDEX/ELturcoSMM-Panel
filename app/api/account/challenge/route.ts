import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { digest, randomHex } from "@/lib/customer-auth";
import { turnstileConfigured } from "@/lib/account-challenge";

export async function POST() {
  const bindings = env as any;
  if (turnstileConfigured()) return NextResponse.json({ mode: "turnstile", siteKey: String(bindings.TURNSTILE_SITE_KEY).trim() }, { headers: { "cache-control": "no-store" } });
  try {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM account_challenges WHERE expires_at<=? OR created_at<?").bind(now, now - 300).run();
    const left = 2 + Math.floor(Math.random() * 7);
    const right = 3 + Math.floor(Math.random() * 8);
    const id = randomHex(16);
    const answerHash = await digest(id + ":" + (left + right));
    await env.DB.prepare("INSERT INTO account_challenges(id,answer_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(id, answerHash, now + 300, now).run();
    return NextResponse.json({ id, question: left + " + " + right + " = ?" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Doğrulama şu anda alınamadı. Tekrar dene." }, { status: 503 });
  }
}
