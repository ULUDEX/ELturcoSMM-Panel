import { env } from "cloudflare:workers";
import { digest } from "@/lib/customer-auth";

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
