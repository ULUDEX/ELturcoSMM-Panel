import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { digest } from "@/lib/customer-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown };
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: "Doğrulama bağlantısı geçersiz veya süresi dolmuş." }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenHash = await digest(token);
    const claimed: any = await env.DB.prepare(`
      UPDATE customer_email_verifications
      SET used_at=?
      WHERE token_hash=? AND used_at IS NULL AND expires_at>?
        AND created_at=(SELECT MAX(created_at) FROM customer_email_verifications WHERE token_hash=?)
      RETURNING user_id
    `).bind(now, tokenHash, now, tokenHash).first();

    if (!claimed?.user_id) {
      return NextResponse.json({ error: "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni hesap oluşturup tekrar dene." }, { status: 400 });
    }

    const result = await env.DB.prepare("UPDATE customer_users SET email_verified_at=? WHERE id=? AND email_verified_at IS NULL")
      .bind(now, claimed.user_id).run();
    if (!result.meta.changes) {
      return NextResponse.json({ ok: true, alreadyVerified: true, message: "E-posta adresin zaten doğrulanmış. Giriş yapabilirsin." });
    }

    await env.DB.prepare("DELETE FROM customer_sessions WHERE user_id=?").bind(claimed.user_id).run();
    return NextResponse.json({ ok: true, message: "E-posta adresin doğrulandı. Hesabın etkinleştirildi; şimdi giriş yapabilirsin." });
  } catch {
    return NextResponse.json({ error: "E-posta doğrulanamadı. Bağlantıyı yenileyip tekrar dene." }, { status: 500 });
  }
}
