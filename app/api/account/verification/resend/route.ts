import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { verifyAccountChallenge } from "@/lib/account-challenge";
import { digest, randomHex } from "@/lib/customer-auth";
import { sendTransactionalEmail, siteBaseUrl } from "@/lib/mailer";

const generic = { ok: true, message: "Eğer doğrulanmamış bir hesabın varsa, yeni bağlantı e-posta adresine gönderildi. Gelen kutunu ve spam klasörünü kontrol et." };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; challengeId?: unknown; challengeAnswer?: unknown };
    const email = String(body.email || "").trim().toLowerCase();
    if (!await verifyAccountChallenge(request,body)) {
      return NextResponse.json({ error: "İnsan doğrulaması başarısız veya süresi dolmuş. Lütfen tekrar doğrula." }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json(generic);

    const user: any = await env.DB.prepare("SELECT id,name,email,email_verified_at FROM customer_users WHERE email=?").bind(email).first();
    if (!user || user.email_verified_at) return NextResponse.json(generic);
    const now = Math.floor(Date.now() / 1000);
    const recent: any = await env.DB.prepare("SELECT COUNT(*) total FROM customer_email_verifications WHERE user_id=? AND created_at>?").bind(user.id, now - 3600).first();
    if (Number(recent?.total || 0) >= 3) return NextResponse.json(generic);

    const token = randomHex(32), tokenHash = await digest(token), expiresAt = now + 24 * 60 * 60;
    await env.DB.prepare("UPDATE customer_email_verifications SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now, user.id).run();
    await env.DB.prepare("INSERT INTO customer_email_verifications(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)").bind(user.id, tokenHash, expiresAt, now).run();
    const verifyUrl = `${siteBaseUrl()}/site/#email-verify=${encodeURIComponent(token)}`;
    const safeName = String(user.name).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const delivery = await sendTransactionalEmail({
      to: email,
      subject: "ElTurco SMM yeni e-posta doğrulama bağlantısı",
      text: `ElTurco SMM hesabını etkinleştirmek için bu bağlantıyı 24 saat içinde aç:\n${verifyUrl}\n\nBu isteği sen yapmadıysan bu e-postayı yok say.`,
      html: `<div style="background:#07111a;padding:32px;font-family:Arial,sans-serif;color:#eef3f6"><div style="max-width:520px;margin:auto;border:1px solid #233b46;border-radius:18px;padding:28px;background:#0b1821"><p style="color:#f6c954;font-size:12px;letter-spacing:2px;font-weight:bold">ELTURCO SMM</p><h1 style="font-size:24px">E-postanı doğrula</h1><p style="color:#b2c0c8;line-height:1.6">Merhaba ${safeName}, hesabını etkinleştirmek için e-posta adresini doğrula. Bağlantı 24 saat geçerlidir.</p><a href="${verifyUrl}" style="display:inline-block;background:#f4c94f;color:#15191b;text-decoration:none;font-weight:bold;padding:13px 18px;border-radius:10px">E-postamı doğrula ve hesabı etkinleştir</a></div></div>`,
    });
    if (!delivery.sent) console.error("verification_email_not_delivered", { userId: user.id, configured: delivery.configured });
    return NextResponse.json(generic);
  } catch {
    return NextResponse.json(generic);
  }
}
