import tls from "node:tls";

const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER?.trim() || "elturcosmm@gmail.com";
const password = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
const recipient = "elturcosmm@gmail.com";
if (!password) throw new Error("SMTP_PASS is missing");
if (port !== 465) throw new Error("SMTP_PORT must be 465 for Gmail SSL");

const socket = tls.connect({ host, port, servername: host });
socket.setTimeout(15000, () => socket.destroy(new Error("SMTP connection timed out")));
let buffer = "";
const lineWaiters = [];
socket.on("data", chunk => {
  buffer += chunk.toString("utf8");
  while (buffer.includes("\n") && lineWaiters.length) {
    const lineEnd = buffer.indexOf("\n");
    lineWaiters.shift()(buffer.slice(0, lineEnd).replace(/\r$/, ""));
    buffer = buffer.slice(lineEnd + 1);
  }
});
const nextLine = () => new Promise((resolve, reject) => {
  if (socket.destroyed) return reject(new Error("SMTP connection closed"));
  const lineEnd = buffer.indexOf("\n");
  if (lineEnd >= 0) {
    const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
    buffer = buffer.slice(lineEnd + 1);
    resolve(line);
  } else lineWaiters.push(resolve);
});
async function reply() {
  const lines = [];
  do { lines.push(await nextLine()); } while (/^\d{3}-/.test(lines.at(-1)));
  return { code: Number(lines.at(-1)?.slice(0, 3)), lines };
}
async function command(value, allowed) {
  await new Promise((resolve, reject) => socket.write(`${value}\r\n`, error => error ? reject(error) : resolve()));
  const response = await reply();
  if (!allowed.includes(response.code)) throw new Error(`SMTP command failed with status ${response.code}`);
  return response;
}
try {
  await new Promise((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
  const greeting = await reply();
  if (greeting.code !== 220) throw new Error(`SMTP greeting failed with status ${greeting.code}`);
  await command("EHLO elturcosmm.com", [250]);
  await command("AUTH LOGIN", [334]);
  await command(Buffer.from(user).toString("base64"), [334]);
  await command(Buffer.from(password).toString("base64"), [235]);
  await command(`MAIL FROM:<${user}>`, [250]);
  await command(`RCPT TO:<${recipient}>`, [250, 251]);
  await command("DATA", [354]);
  const message = [
    `From: ElTurco SMM <${user}>`,
    `To: <${recipient}>`,
    "Subject: ElTurco SMM email delivery test",
    `Date: ${new Date().toUTCString()}`,
    "Message-ID: <smtp-test@elturcosmm.com>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "One-time test of the ElTurco SMM Gmail SMTP delivery used by password reset.",
  ].join("\r\n").replace(/\r?\n\./g, "\r\n..");
  await new Promise((resolve, reject) => socket.write(`${message}\r\n.\r\n`, error => error ? reject(error) : resolve()));
  const accepted = await reply();
  if (accepted.code !== 250) throw new Error(`SMTP message rejected with status ${accepted.code}`);
  await command("QUIT", [221]);
  console.log(`Gmail SMTP accepted the one-time test message for ${recipient}.`);
} finally {
  socket.end();
}
