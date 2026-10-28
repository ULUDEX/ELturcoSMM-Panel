import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const allowedAvatars = new Set(["man-1", "man-2", "man-3", "man-4", "man-5", "man-6", "woman-1", "woman-2", "woman-3", "woman-4", "woman-5", "woman-6"]);

export async function POST(request: Request) {
  const user = await currentCustomer();
  if (!user) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });

  try {
    const body = await request.json() as { avatar?: unknown; name?: unknown };
    const avatar = body.avatar === undefined ? user.avatar : String(body.avatar);
    const name = body.name === undefined ? user.name : String(body.name).trim();
    if (!allowedAvatars.has(avatar)) return NextResponse.json({ error: "Geçersiz avatar seçimi." }, { status: 400 });
    if (name.length < 2 || name.length > 60) return NextResponse.json({ error: "Adın 2–60 karakter olmalı." }, { status: 400 });
    await env.DB.prepare("UPDATE customer_users SET avatar=?,name=? WHERE id=?").bind(avatar, name, user.id).run();
    return NextResponse.json({ ok: true, avatar, user: { ...user, name, avatar } }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Avatar kaydedilemedi. Tekrar dene." }, { status: 400 });
  }
}
