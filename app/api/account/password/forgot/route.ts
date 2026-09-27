import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { consumeAccountChallenge } from "@/lib/account-challenge";
import { randomHex, digest } from "@/lib/customer-auth";
import { sendTransactionalEmail, siteBaseUrl } from "@/lib/mailer";

const generic = { ok: true, message: "Eğer bu e-posta ile kayıtlı bir hesap varsa, şifre yenileme bağlantısı gönderildi." };
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; challengeId?: unknown; challengeAnswer?: unknown };
    const email = String(body.email || "").trim().toLowerCase();
    if (!await consumeAccountChallenge(body.challengeId, body.challengeAnswer)) return NextResponse.json({ error: "Doğrulama geçersiz veya süresi dolmuş. Yeni soruyu çöz." }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json(generic);
    const user: any = await env.DB.prepare("SELECT id,email FROM customer_users WHERE email=?").bind(email).first();
    if (!user) return NextResponse.json(generic);
    const now = Math.floor(Date.now() / 1000);
    const recent: any = await env.DB.prepare("SELECT COUNT(*) total FROM customer_password_resets WHERE user_id=? AND created_at>?").bind(user.id, now - 3600).first();
    if (Number(recent?.total || 0) >= 3) return NextResponse.json(generic);
    const token = randomHex(32), tokenHash = await digest(token), expiresAt = now + 30 * 60;
    await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, user.id).run();
    await env.DB.prepare("INSERT INTO customer_password_resets(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(user.id, tokenHash, expiresAt, now).run();
    const resetUrl = `${siteBaseUrl()}/site/#password-reset=${encodeURIComponent(token)}`;
    await sendTransactionalEmail({
      to: email,
      subject: "ElTurco SMM şifre yenileme bağlantısı",
      text: `Şifreni yenilemek için bu bağlantıyı 30 dakika içinde aç:\n${resetUrl}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Şifren bu bağlantıyı kullanmadıkça değişmez.`,
      html: `<div style="background:#07111a;padding:32px;font-family:Arial,sans-serif;color:#eef3f6"><div style="max-width:520px;margin:auto;border:1px solid #233b46;border-radius:18px;padding:28px;background:#0b1821"><p style="color:#f6c954;font-size:12px;letter-spacing:2px;font-weight:bold">ELTURCO SMM</p><h1 style="font-size:24px">Şifreni yenile</h1><p style="color:#b2c0c8;line-height:1.6">Hesabın için şifre yenileme isteği aldık. Bağlantı 30 dakika geçerlidir.</p><a href="${resetUrl}" style="display:inline-block;background:#f4c94f;color:#15191b;text-decoration:none;font-weight:bold;padding:13px 18px;border-radius:10px">Yeni şifre belirle</a><p style="margin-top:24px;color:#8798a2;font-size:12px;line-height:1.6">Bu isteği sen yapmadıysan e-postayı yok say. Şifren bağlantıyı kullanmadıkça değişmez.</p></div></div>`,
    });
    return NextResponse.json(generic);
  } catch {
    // Do not reveal account existence or email-provider state.
    return NextResponse.json(generic);
  }
}
