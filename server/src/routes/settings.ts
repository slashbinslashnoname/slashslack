import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SocketEvents, updateSettingsSchema } from "@slashslack/shared";
import { db, getSettings, saveSettings } from "../db/index.js";
import { attachments } from "../db/schema.js";
import { currentUser, requireAdmin } from "../auth.js";
import { broadcast } from "../realtime/index.js";
import { storeUpload } from "../services/uploads.js";
import { fileUrl } from "../lib/serialize.js";
import { PRESETS, type StoredSettings } from "../settings.js";
import { mailerConfigured } from "../services/mailer.js";

/** Public view: never leak SMTP credentials; always include presets. */
function publicSettings(s: StoredSettings) {
  const { smtp, ...pub } = s;
  return { ...pub, presets: PRESETS };
}

export async function settingsRoutes(app: FastifyInstance) {
  // public: the login screen needs branding + theme before auth
  app.get("/api/settings", async () => {
    return { settings: publicSettings(getSettings()) };
  });

  app.patch("/api/settings", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const current = getSettings();
    const next: StoredSettings = {
      ...current,
      ...parsed.data,
      theme: parsed.data.theme ? { ...current.theme, ...parsed.data.theme } : current.theme,
    };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: publicSettings(next) });
    return { settings: publicSettings(next) };
  });

  app.post("/api/settings/preset/:name", { preHandler: requireAdmin }, async (req, reply) => {
    const name = (req.params as any).name as string;
    const preset = PRESETS[name];
    if (!preset) return reply.code(404).send({ error: "Unknown preset" });
    const current = getSettings();
    const next: StoredSettings = {
      ...current,
      theme: preset,
      defaultTheme: (name === "dark" ? "dark" : "light") as "light" | "dark",
    };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: publicSettings(next) });
    return { settings: publicSettings(next) };
  });

  app.post("/api/settings/logo", { preHandler: requireAdmin }, async (req, reply) => {
    const user = currentUser(req);
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "No file" });
    if (!/^image\/(png|jpe?g|gif|webp|avif)$/i.test(file.mimetype))
      return reply.code(415).send({ error: "Logo must be an image" });
    const buffer = await file.toBuffer();
    const stored = await storeUpload(file.filename, file.mimetype, buffer);
    db.insert(attachments)
      .values({
        messageId: null,
        uploaderId: user.id,
        filename: stored.filename,
        mime: stored.mime,
        size: stored.size,
        width: stored.width,
        height: stored.height,
        storagePath: stored.storagePath,
        thumbPath: stored.thumbPath,
      })
      .run();
    const url = fileUrl(stored.storagePath);
    const next: StoredSettings = { ...getSettings(), logoUrl: url };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: publicSettings(next) });
    return { logoUrl: url };
  });

  // ---- SMTP (admin only; password never returned) ----
  app.get("/api/settings/smtp", { preHandler: requireAdmin }, async () => {
    const s = getSettings().smtp;
    return {
      smtp: {
        enabled: s?.enabled ?? false,
        host: s?.host ?? "",
        port: s?.port ?? 587,
        user: s?.user ?? "",
        from: s?.from ?? "",
        secure: s?.secure ?? false,
        hasPassword: !!s?.pass,
      },
      mailerConfigured: mailerConfigured(),
    };
  });

  const smtpSchema = z.object({
    enabled: z.boolean(),
    host: z.string().max(200),
    port: z.number().int().min(1).max(65535),
    user: z.string().max(200),
    from: z.string().max(200),
    secure: z.boolean(),
    pass: z.string().max(400).optional(), // omitted/empty = keep existing
  });

  app.patch("/api/settings/smtp", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = smtpSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid SMTP config" });
    const current = getSettings();
    const next: StoredSettings = {
      ...current,
      smtp: {
        enabled: parsed.data.enabled,
        host: parsed.data.host,
        port: parsed.data.port,
        user: parsed.data.user,
        from: parsed.data.from,
        secure: parsed.data.secure,
        // keep existing password unless a new non-empty one is provided
        pass: parsed.data.pass ? parsed.data.pass : current.smtp?.pass ?? "",
      },
    };
    saveSettings(next);
    return { ok: true, mailerConfigured: mailerConfigured() };
  });
}
