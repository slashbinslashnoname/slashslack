import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { SocketEvents } from "@slashslack/shared";
import { db, raw } from "../db/index.js";
import { bookmarks, channelMembers, dmMembers, messages } from "../db/schema.js";
import { currentUser, requireAuth } from "../auth.js";
import { loadMessage, loadMessages } from "../lib/serialize.js";
import { emitToChannel, emitToDm } from "../realtime/index.js";
import { canSeeChannel, canSeeDm } from "../services/channels.js";

function canSeeMessage(
  msg: { channelId: number | null; dmId: number | null },
  userId: number,
) {
  if (msg.channelId) return canSeeChannel(msg.channelId, userId);
  if (msg.dmId) return canSeeDm(msg.dmId, userId);
  return false;
}

export async function extraRoutes(app: FastifyInstance) {
  // ---- pins ----
  app.post("/api/messages/:id/pin", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const msg = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg) return reply.code(404).send({ error: "Not found" });
    if (!canSeeMessage(msg, user.id)) return reply.code(403).send({ error: "No access" });
    const nowPinned = !msg.pinnedAt;
    db.update(messages)
      .set({
        pinnedAt: nowPinned ? new Date().toISOString() : null,
        pinnedBy: nowPinned ? user.id : null,
      })
      .where(eq(messages.id, id))
      .run();
    const full = loadMessage(id)!;
    const payload = { message: full, pinned: nowPinned };
    if (msg.channelId) emitToChannel(msg.channelId, SocketEvents.MessagePinned, payload);
    else if (msg.dmId) emitToDm(msg.dmId, SocketEvents.MessagePinned, payload);
    return { message: full };
  });

  app.get("/api/channels/:id/pins", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canSeeChannel(id, user.id)) return reply.code(403).send({ error: "No access" });
    const pinnedRows = raw
      .prepare(
        "SELECT id FROM messages WHERE channel_id = ? AND pinned_at IS NOT NULL AND deleted_at IS NULL ORDER BY pinned_at DESC",
      )
      .all(id) as { id: number }[];
    return { messages: loadMessages(pinnedRows.map((r) => r.id)) };
  });

  // ---- bookmarks (saved items) ----
  app.post("/api/messages/:id/bookmark", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const msg = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg || !canSeeMessage(msg, user.id)) return reply.code(403).send({ error: "No access" });
    const existing = db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.messageId, id)))
      .get();
    if (existing) {
      db.delete(bookmarks)
        .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.messageId, id)))
        .run();
      return { bookmarked: false };
    }
    db.insert(bookmarks).values({ userId: user.id, messageId: id }).run();
    return { bookmarked: true };
  });

  app.get("/api/bookmarks", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const rows = db
      .select({ id: bookmarks.messageId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, user.id))
      .orderBy(desc(bookmarks.createdAt))
      .all();
    return {
      ids: rows.map((r) => r.id),
      messages: loadMessages(rows.map((r) => r.id)),
    };
  });

  // ---- read receipts ----
  app.get("/api/channels/:id/receipts", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canSeeChannel(id, user.id)) return reply.code(403).send({ error: "No access" });
    const rows = db
      .select({
        userId: channelMembers.userId,
        lastReadMessageId: channelMembers.lastReadMessageId,
      })
      .from(channelMembers)
      .where(eq(channelMembers.channelId, id))
      .all();
    return { receipts: rows };
  });

  app.get("/api/dms/:id/receipts", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canSeeDm(id, user.id)) return reply.code(403).send({ error: "No access" });
    const rows = db
      .select({
        userId: dmMembers.userId,
        lastReadMessageId: dmMembers.lastReadMessageId,
      })
      .from(dmMembers)
      .where(eq(dmMembers.dmId, id))
      .all();
    return { receipts: rows };
  });
}
