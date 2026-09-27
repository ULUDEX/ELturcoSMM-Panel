import { env } from "cloudflare:workers";
import { sendTransactionalEmail } from "@/lib/mailer";

export type NotificationTranslation = { title: string; body: string };

export async function addCustomerNotification(input: {
  email: string;
  kind: "order" | "balance" | "announcement" | "security";
  title: string;
  body: string;
  translations?: Record<string, NotificationTranslation>;
  orderId?: number;
  emailSubject?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const at = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(`INSERT INTO customer_notifications(customer_email,kind,title,body,translations,order_id,created_at)
      VALUES(?,?,?,?,?,?,?)`).bind(email, input.kind, input.title.slice(0, 160), input.body.slice(0, 1200), JSON.stringify(input.translations || {}), input.orderId || null, at).run();
  } catch (error) {
    console.error("customer_notification_failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return;
  }
  if (input.emailSubject) {
    await sendTransactionalEmail({
      to: email,
      subject: input.emailSubject,
      text: `${input.title}\n\n${input.body}\n\nHesabını görüntüle: ${(String((env as any).SITE_URL || "https://elturcosmm.com")).replace(/\/$/, "")}/site/`,
    });
  }
}
