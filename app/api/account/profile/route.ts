import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

const allowedAvatars = new Set(["man-1", "man-2", "man-3", "woman-1", "woman-2", "woman-3"]);

export async function POST(request: Request) {
  const user = await currentCustomer();
  if (!user) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });

  try {
    const body = await request.json() as { avatar?: unknown };
    const avatar = typeof body.avatar === "string" ? body.avatar : "";
    if (!allowedAvatars.has(avatar)) return NextResponse.json({ error: "Geçersiz avatar seçimi." }, { status: 400 });
    await env.DB.prepare("UPDATE customer_users SET avatar=? WHERE id=?").bind(avatar, user.id).run();
    return NextResponse.json({ ok: true, avatar }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Avatar kaydedilemedi. Tekrar dene." }, { status: 400 });
  }
}
