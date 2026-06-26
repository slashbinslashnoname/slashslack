import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let initialized = false;

/** SMTP is optional. When unconfigured, the app falls back to returning the link. */
export function mailerConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

function getTransporter(): Transporter | null {
  if (initialized) return transporter;
  initialized = true;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const t = getTransporter();
  if (!t) return { sent: false };
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "SlashSlack <no-reply@slashslack.local>",
      ...opts,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export function inviteEmail(appName: string, inviter: string, url: string) {
  const text = `${inviter} invited you to join ${appName}.\n\nJoin here: ${url}\n`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#3f0e40">You're invited to ${escapeHtml(appName)}</h2>
      <p><strong>${escapeHtml(inviter)}</strong> invited you to join the workspace.</p>
      <p><a href="${url}" style="display:inline-block;background:#1264a3;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Accept invitation</a></p>
      <p style="color:#696769;font-size:13px">Or paste this link: ${url}</p>
    </div>`;
  return { text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
