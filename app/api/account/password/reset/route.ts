import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { digest, passwordHash, randomHex } from "@/lib/customer-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; newPassword?: unknown; confirmPassword?: unknown };
    const token = String(body.token || ""), password = String(body.newPassword || ""), confirm = String(body.confirmPassword || "");
    if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı iste." }, { status: 400 });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "Şifre 8–128 karakter arasında olmalı." }, { status: 400 });
    if (password !== confirm) return NextResponse.json({ error: "Şifreler eşleşmiyor." }, { status: 400 });
    const tokenHash = await digest(token), now = Math.floor(Date.now() / 1000);
    const claimed: any = await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND created_at=(SELECT MAX(created_at) FROM customer_password_resets WHERE token_hash=?) RETURNING user_id").bind(now, tokenHash, now, tokenHash).first();
    if (!claimed?.user_id) return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı iste." }, { status: 400 });
    const salt = randomHex(16), hash = await passwordHash(password, salt);
    await env.DB.prepare("UPDATE customer_users SET password_hash=?,password_salt=? WHERE id=?").bind(hash, salt, claimed.user_id).run();
    await env.DB.prepare("DELETE FROM customer_sessions WHERE user_id=?").bind(claimed.user_id).run();
    await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, claimed.user_id).run();
    return NextResponse.json({ ok: true, message: "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin." });
  } catch {
    return NextResponse.json({ error: "Şifre yenilenemedi. Yeni bağlantı isteyip tekrar dene." }, { status: 500 });
  }
}
