import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { SocketEvents, updateSettingsSchema } from "@slashslack/shared";
import { db, getSettings, saveSettings } from "../db/index.js";
import { attachments } from "../db/schema.js";
import { currentUser, requireAdmin } from "../auth.js";
import { broadcast } from "../realtime/index.js";
import { storeUpload } from "../services/uploads.js";
import { fileUrl } from "../lib/serialize.js";
import { PRESETS } from "../settings.js";

export async function settingsRoutes(app: FastifyInstance) {
  // public: the login screen needs branding + theme before auth
  app.get("/api/settings", async () => {
    const s = getSettings();
    return { settings: { ...s, presets: PRESETS } };
  });

  app.patch("/api/settings", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const current = getSettings();
    const next = {
      ...current,
      ...parsed.data,
      theme: parsed.data.theme
        ? { ...current.theme, ...parsed.data.theme }
        : current.theme,
    };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: { ...next, presets: PRESETS } });
    return { settings: { ...next, presets: PRESETS } };
  });

  // apply a named preset wholesale
  app.post("/api/settings/preset/:name", { preHandler: requireAdmin }, async (req, reply) => {
    const name = (req.params as any).name as string;
    const preset = PRESETS[name];
    if (!preset) return reply.code(404).send({ error: "Unknown preset" });
    const current = getSettings();
    const next = {
      ...current,
      theme: preset,
      defaultTheme: (name === "dark" ? "dark" : "light") as "light" | "dark",
    };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: { ...next, presets: PRESETS } });
    return { settings: { ...next, presets: PRESETS } };
  });

  // upload a new app logo/icon
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
    const current = getSettings();
    const next = { ...current, logoUrl: url };
    saveSettings(next);
    broadcast(SocketEvents.SettingsUpdated, { settings: { ...next, presets: PRESETS } });
    return { logoUrl: url };
  });
}
