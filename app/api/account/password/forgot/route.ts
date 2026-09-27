import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { verifyAccountChallenge } from "@/lib/account-challenge";
import { randomHex, digest } from "@/lib/customer-auth";
import { sendTransactionalEmail } from "@/lib/mailer";

const generic = { ok: true, emailSent: false, message: "Bu e-posta ile etkinleştirilmiş hesap bulunamadı." };
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; challengeId?: unknown; challengeAnswer?: unknown };
    const email = String(body.email || "").trim().toLowerCase();
    if (!await verifyAccountChallenge(request,body)) return NextResponse.json({ error: "İnsan doğrulaması başarısız veya süresi dolmuş. Lütfen tekrar doğrula." }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json(generic);
    const user: any = await env.DB.prepare("SELECT id,email,email_verified_at FROM customer_users WHERE email=?").bind(email).first();
    if (!user) return NextResponse.json(generic);
    if (!user.email_verified_at) return NextResponse.json(generic);
    const now = Math.floor(Date.now() / 1000);
    const recent: any = await env.DB.prepare("SELECT COUNT(*) total FROM customer_password_resets WHERE user_id=? AND created_at>?").bind(user.id, now - 3600).first();
    if (Number(recent?.total || 0) >= 3) return NextResponse.json({ error: "Saatte en fazla 3 kod isteyebilirsin. Daha sonra tekrar dene." }, { status: 429 });
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"), salt = randomHex(16), tokenHash = `${salt}$${await digest(`${salt}:${code}`)}`, expiresAt = now + 15 * 60;
    await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, user.id).run();
    await env.DB.prepare("INSERT INTO customer_password_resets(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(user.id, tokenHash, expiresAt, now).run();
    const delivery = await sendTransactionalEmail({
      to: email,
      subject: "ElTurco SMM şifre yenileme kodun",
      text: `Şifre yenileme kodun: ${code}\n\nKod 15 dakika geçerlidir ve bir kez kullanılabilir. Bu isteği sen yapmadıysan kodu kimseyle paylaşma ve bu e-postayı yok say.`,
      html: `<div style="background:#07111a;padding:32px;font-family:Arial,sans-serif;color:#eef3f6"><div style="max-width:520px;margin:auto;border:1px solid #233b46;border-radius:18px;padding:28px;background:#0b1821"><p style="color:#f6c954;font-size:12px;letter-spacing:2px;font-weight:bold">ELTURCO SMM</p><h1 style="font-size:24px">Şifre yenileme kodun</h1><p style="color:#b2c0c8;line-height:1.6">Aşağıdaki kodu şifre yenileme ekranına gir. Kod 15 dakika geçerlidir.</p><div style="margin:22px 0;padding:16px;border:1px solid #5e512c;border-radius:12px;background:#151b1e;color:#ffe17d;font-size:32px;font-weight:bold;letter-spacing:10px;text-align:center">${code}</div><p style="color:#8798a2;font-size:12px;line-height:1.6">Bu isteği sen yapmadıysan kodu kullanma ve kimseyle paylaşma.</p></div></div>`,
    });
    if (!delivery.sent) {
      await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, user.id).run();
      console.error("password_reset_email_not_delivered", { userId: user.id, configured: delivery.configured });
      return NextResponse.json({ error: delivery.configured ? `Gmail e-posta gönderimini kabul etmedi (${delivery.reason || "SMTP_ERROR"}). Uygulama şifresini ve SMTP ayarlarını kontrol et.` : "E-posta gönderimi yapılandırılmamış. SMTP_PASS production secret değerini kontrol et." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, emailSent: true, message: "Şifre yenileme kodu e-postana gönderildi. Gelen kutunu ve spam klasörünü kontrol et. Kod 15 dakika geçerli." });
  } catch {
    return NextResponse.json({ error: "Şifre yenileme isteği tamamlanamadı. Biraz sonra tekrar dene." }, { status: 500 });
  }
}
