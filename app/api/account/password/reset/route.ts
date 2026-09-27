import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { digest, passwordHash, randomHex } from "@/lib/customer-auth";

const invalidCode = () => NextResponse.json({ error: "Kod yanlış, süresi dolmuş veya daha önce kullanılmış. Yeni kod iste." }, { status: 400 });

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; email?: unknown; code?: unknown; newPassword?: unknown; confirmPassword?: unknown };
    const token = String(body.token || ""), email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim(), password = String(body.newPassword || ""), confirm = String(body.confirmPassword || "");
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "Şifre 8–128 karakter arasında olmalı." }, { status: 400 });
    if (password !== confirm) return NextResponse.json({ error: "Şifreler eşleşmiyor." }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);
    let claimed: any = null;
    if (/^[a-f0-9]{64}$/i.test(token)) {
      const tokenHash = await digest(token);
      claimed = await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? RETURNING user_id")
        .bind(now, tokenHash, now).first();
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return invalidCode();
      const user: any = await env.DB.prepare("SELECT id FROM customer_users WHERE email=? AND email_verified_at IS NOT NULL").bind(email).first();
      if (!user) return invalidCode();
      const reset: any = await env.DB.prepare("SELECT id,token_hash,expires_at,attempts FROM customer_password_resets WHERE user_id=? AND used_at IS NULL ORDER BY id DESC LIMIT 1").bind(user.id).first();
      if (!reset || Number(reset.expires_at) <= now || Number(reset.attempts) >= 5) return invalidCode();
      const [salt, expected] = String(reset.token_hash).split("$");
      const validHash = Boolean(salt && /^[a-f0-9]{64}$/i.test(expected || ""));
      const actual = validHash ? await digest(`${salt}:${code}`) : "";
      let mismatch = validHash ? actual.length ^ expected.length : 1;
      for (let i = 0; i < Math.min(actual.length, validHash ? expected.length : 0); i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
      if (mismatch !== 0) {
        await env.DB.prepare("UPDATE customer_password_resets SET attempts=attempts+1,used_at=CASE WHEN attempts+1>=5 THEN ? ELSE used_at END WHERE id=? AND used_at IS NULL AND expires_at>? AND attempts<5")
          .bind(now, reset.id, now).run();
        return invalidCode();
      }
      claimed = await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE id=? AND user_id=? AND used_at IS NULL AND expires_at>? AND attempts<5 RETURNING user_id")
        .bind(now, reset.id, user.id, now).first();
    }
    if (!claimed?.user_id) return invalidCode();

    const salt = randomHex(16), hash = await passwordHash(password, salt);
    await env.DB.prepare("UPDATE customer_users SET password_hash=?,password_salt=? WHERE id=?").bind(hash, salt, claimed.user_id).run();
    await env.DB.prepare("DELETE FROM customer_sessions WHERE user_id=?").bind(claimed.user_id).run();
    await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, claimed.user_id).run();
    return NextResponse.json({ ok: true, message: "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin." });
  } catch {
    return NextResponse.json({ error: "Şifre yenilenemedi. Yeni kod isteyip tekrar dene." }, { status: 500 });
  }
}
