import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer, CUSTOMER_COOKIE, createCustomerSession, customerCookieOptions, passwordHash, randomHex, verifyPassword } from "@/lib/customer-auth";

export async function POST(request: Request) {
  const user = await currentCustomer();
  if (!user) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
  try {
    const body = await request.json() as { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown };
    const currentPassword = String(body.currentPassword || ""), newPassword = String(body.newPassword || ""), confirmPassword = String(body.confirmPassword || "");
    if (newPassword.length < 8 || newPassword.length > 128) return NextResponse.json({ error: "Yeni şifre 8–128 karakter arasında olmalı." }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ error: "Yeni şifreler eşleşmiyor." }, { status: 400 });
    const record: any = await env.DB.prepare("SELECT password_hash,password_salt FROM customer_users WHERE id=?").bind(user.id).first();
    if (!record || !await verifyPassword(currentPassword, record.password_salt, record.password_hash)) return NextResponse.json({ error: "Mevcut şifre doğru değil." }, { status: 400 });
    const salt = randomHex(16), hash = await passwordHash(newPassword, salt), at = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE customer_users SET password_hash=?,password_salt=? WHERE id=?").bind(hash, salt, user.id).run();
    await env.DB.prepare("DELETE FROM customer_sessions WHERE user_id=?").bind(user.id).run();
    await env.DB.prepare("UPDATE customer_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(at, user.id).run();
    const session = await createCustomerSession(user.id), response = NextResponse.json({ ok: true });
    response.cookies.set(CUSTOMER_COOKIE, session.token, customerCookieOptions(session.expires));
    return response;
  } catch {
    return NextResponse.json({ error: "Şifre güncellenemedi. Lütfen tekrar dene." }, { status: 500 });
  }
}
