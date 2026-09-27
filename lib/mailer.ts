import { connect } from "cloudflare:sockets";
import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

function base64(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function emailAddress(value: string) {
  const trimmed = value.trim();
  const bracketed = trimmed.match(/<([^<>]+)>$/);
  const address = (bracketed?.[1] || trimmed).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) {
    throw new Error("Invalid email address");
  }
  return address;
}

function formatFrom(value: string) {
  const match = value.trim().match(/^(.*?)\s*<([^<>]+)>$/);
  const address = emailAddress(match?.[2] || value);
  const name = match?.[1]?.trim().replace(/[\r\n]/g, "") || "";
  if (!name) return `<${address}>`;
  const encodedName = /[^\x20-\x7e]/.test(name)
    ? `=?UTF-8?B?${base64(name).replace(/\r\n/g, "")}?=`
    : `"${name.replace(/[\\"]/g, "\\$&")}"`;
  return `${encodedName} <${address}>`;
}

function smtpReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";

  return async () => {
    while (!buffer.includes("\n")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP server closed the connection");
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error("SMTP response is too large");
    }

    const lines: string[] = [];
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      lines.push(buffer.slice(0, newline).replace(/\r$/, ""));
      buffer = buffer.slice(newline + 1);
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) break;
      if (lines.length > 32) throw new Error("SMTP response has too many lines");
    }

    const code = Number(lines.at(-1)?.slice(0, 3));
    return { code, lines };
  };
}

function expectCode(response: { code: number; lines: string[] }, allowed: number[]) {
  if (!allowed.includes(response.code)) {
    throw new Error(`SMTP command failed with status ${response.code}`);
  }
  return response;
}

function mimeBody(text: string, html: string) {
  const boundary = `elturco-${crypto.randomUUID()}`;
  return [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "MIME-Version: 1.0",
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(html),
    `--${boundary}--`,
  ].join("\r\n");
}

export function mailConfigured() {
  const bindings = env as any;
  const defaultGmail = "elturcosmm@gmail.com";
  return Boolean(
    String(bindings.SMTP_USER || defaultGmail).trim()
    && String(bindings.SMTP_PASS || "").trim()
  );
}

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html?: string }) {
  const bindings = env as any;
  const host = String(bindings.SMTP_HOST || "smtp.gmail.com").trim();
  const user = String(bindings.SMTP_USER || "elturcosmm@gmail.com").trim();
  const password = String(bindings.SMTP_PASS || "").replace(/\s+/g, "");
  const from = String(bindings.EMAIL_FROM || `ElTurco SMM <${user}>`).trim();
  if (!host || !user || !password || !from) return { sent: false, configured: false };

  const port = Number(bindings.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port !== 465) {
    console.error("transactional_email_failed", { reason: "SMTP_PORT must be 465" });
    return { sent: false, configured: true };
  }

  let socket: ReturnType<typeof connect> | undefined;
  try {
    const fromAddress = emailAddress(from);
    const toAddress = emailAddress(input.to);
    const safeSubject = input.subject.replace(/[\r\n]/g, " ").slice(0, 180);
    const text = input.text.slice(0, 12000);
    const html = input.html || `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#15202b">${text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)).replace(/\n/g, "<br>")}</div>`;

    socket = connect({ hostname: host, port }, { secureTransport: "on" });
    await socket.opened;
    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    const readReply = smtpReader(reader);
    const write = async (value: string) => writer.write(encoder.encode(`${value}\r\n`));
    const command = async (value: string, allowed: number[]) => {
      await write(value);
      return expectCode(await readReply(), allowed);
    };

    expectCode(await readReply(), [220]);
    await command("EHLO elturcosmm.com", [250]);
    await command("AUTH LOGIN", [334]);
    await command(base64(user).replace(/\r\n/g, ""), [334]);
    await command(base64(password).replace(/\r\n/g, ""), [235]);
    await command(`MAIL FROM:<${fromAddress}>`, [250]);
    await command(`RCPT TO:<${toAddress}>`, [250, 251]);
    await command("DATA", [354]);

    const encodedSubject = `=?UTF-8?B?${base64(safeSubject).replace(/\r\n/g, "")}?=`;
    const message = [
      `From: ${formatFrom(from)}`,
      `To: <${toAddress}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@elturcosmm.com>`,
      mimeBody(text, html),
    ].join("\r\n").replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    await writer.write(encoder.encode(`${message}\r\n.\r\n`));
    expectCode(await readReply(), [250]);
    await command("QUIT", [221]);
    await reader.cancel();
    await writer.close();
    await socket.close();
    return { sent: true, configured: true };
  } catch (error) {
    console.error("transactional_email_failed", {
      error: error instanceof Error ? error.message.slice(0, 120) : "UnknownError",
    });
    try { await socket?.close(); } catch { /* Socket may already be closed. */ }
    return { sent: false, configured: true };
  }
}

export function siteBaseUrl() {
  const configured = String((env as any).SITE_URL || "").trim();
  return (configured || "https://elturcosmm.com").replace(/\/$/, "");
}
