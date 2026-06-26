import nodemailer from "nodemailer";
import { getSettings } from "../db/index.js";
import type { SmtpConfig } from "../settings.js";

/**
 * Resolve SMTP config: admin settings (DB) take precedence; otherwise fall back
 * to environment variables. Returns null when nothing is configured.
 */
export function resolveSmtp(): SmtpConfig | null {
  const s = getSettings().smtp;
  if (s && s.enabled && s.host) return s;
  if (process.env.SMTP_HOST) {
    return {
      enabled: true,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM || "SlashSlack <no-reply@slashslack.local>",
      secure: process.env.SMTP_SECURE === "true",
    };
  }
  return null;
}

export function mailerConfigured(): boolean {
  return !!resolveSmtp();
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
  const cfg = resolveSmtp();
  if (!cfg) return { sent: false };
  try {
    const t = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    await t.sendMail({
      from: cfg.from || "SlashSlack <no-reply@slashslack.local>",
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
