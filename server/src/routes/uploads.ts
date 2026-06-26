import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { SocketEvents } from "@slashslack/shared";
import { loadMessage } from "../lib/serialize.js";
import { emitToChannel, emitToDm } from "../realtime/index.js";
import { messages } from "../db/schema.js";
import { db, getSettings } from "../db/index.js";
import { attachments } from "../db/schema.js";
import { currentUser, requireAuth } from "../auth.js";
import { isAllowedMime, storeUpload } from "../services/uploads.js";
import { fileUrl } from "../lib/serialize.js";

export async function uploadRoutes(app: FastifyInstance) {
  // Upload one file; returns an attachment id to attach to a subsequent message.
  app.post("/api/uploads", { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req);
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "No file" });
    if (!isAllowedMime(file.mimetype))
      return reply.code(415).send({ error: `Unsupported file type: ${file.mimetype}` });
    const buffer = await file.toBuffer();
    const maxBytes = getSettings().maxUploadMb * 1024 * 1024;
    if (buffer.length > maxBytes)
      return reply
        .code(413)
        .send({ error: `File too large (max ${getSettings().maxUploadMb} MB)` });
    const stored = await storeUpload(file.filename, file.mimetype, buffer);
    const row = db
      .insert(attachments)
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
      .returning()
      .get();
    return {
      attachment: {
        id: row.id,
        messageId: null,
        filename: row.filename,
        mime: row.mime,
        size: row.size,
        width: row.width,
        height: row.height,
        url: fileUrl(row.storagePath),
        thumbUrl: fileUrl(row.thumbPath),
      },
    };
  });

  // rename an attachment's displayed filename (uploader or message owner)
  app.patch("/api/attachments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const parsed = z.object({ filename: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid filename" });
    const me = currentUser(req);
    const att = db.select().from(attachments).where(eq(attachments.id, id)).get();
    if (!att) return reply.code(404).send({ error: "Not found" });

    let allowed = att.uploaderId === me.id || me.role === "admin";
    if (!allowed && att.messageId) {
      const msg = db.select().from(messages).where(eq(messages.id, att.messageId)).get();
      allowed = !!msg && msg.userId === me.id;
    }
    if (!allowed) return reply.code(403).send({ error: "Not allowed" });

    db.update(attachments).set({ filename: parsed.data.filename }).where(eq(attachments.id, id)).run();

    // push the updated message so the new filename shows live
    if (att.messageId) {
      const full = loadMessage(att.messageId);
      if (full) {
        if (full.channelId) emitToChannel(full.channelId, SocketEvents.MessageEdit, full);
        else if (full.dmId) emitToDm(full.dmId, SocketEvents.MessageEdit, full);
      }
    }
    return { ok: true };
  });
}
