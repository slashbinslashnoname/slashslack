import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import {
  SocketEvents,
  createMessageSchema,
  editMessageSchema,
  toggleReactionSchema,
} from "@slashslack/shared";
import { db } from "../db/index.js";
import {
  channels,
  dmMembers,
  messages,
  reactions,
} from "../db/schema.js";
import { currentUser, requireAuth, toPublicUser } from "../auth.js";
import { loadMessage, loadMessages } from "../lib/serialize.js";
import { createMessageRecord } from "../services/messages.js";
import { isMember } from "../services/channels.js";
import { emitToChannel, emitToDm } from "../realtime/index.js";

function canSeeChannel(channelId: number, userId: number) {
  const ch = db.select().from(channels).where(eq(channels.id, channelId)).get();
  if (!ch) return false;
  return !ch.isPrivate || isMember(channelId, userId);
}
function canSeeDm(dmId: number, userId: number) {
  return !!db
    .select()
    .from(dmMembers)
    .where(and(eq(dmMembers.dmId, dmId), eq(dmMembers.userId, userId)))
    .get();
}

export async function messageRoutes(app: FastifyInstance) {
  // list top-level messages of a channel (newest-first window, returned ascending)
  app.get("/api/channels/:id/messages", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canSeeChannel(id, user.id)) return reply.code(403).send({ error: "No access" });
    const { before, limit } = req.query as { before?: string; limit?: string };
    const lim = Math.min(Number(limit) || 50, 100);
    const rows = db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, id),
          isNull(messages.parentId),
          before ? lt(messages.id, Number(before)) : undefined,
        ),
      )
      .orderBy(desc(messages.id))
      .limit(lim)
      .all();
    const list = loadMessages(rows.map((r) => r.id).reverse());
    return { messages: list, hasMore: rows.length === lim };
  });

  app.get("/api/dms/:id/messages", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canSeeDm(id, user.id)) return reply.code(403).send({ error: "No access" });
    const { before, limit } = req.query as { before?: string; limit?: string };
    const lim = Math.min(Number(limit) || 50, 100);
    const rows = db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.dmId, id),
          isNull(messages.parentId),
          before ? lt(messages.id, Number(before)) : undefined,
        ),
      )
      .orderBy(desc(messages.id))
      .limit(lim)
      .all();
    return { messages: loadMessages(rows.map((r) => r.id).reverse()), hasMore: rows.length === lim };
  });

  // thread: parent + all replies (ascending)
  app.get("/api/messages/:id/thread", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const parent = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!parent) return reply.code(404).send({ error: "Not found" });
    if (parent.channelId && !canSeeChannel(parent.channelId, user.id))
      return reply.code(403).send({ error: "No access" });
    if (parent.dmId && !canSeeDm(parent.dmId, user.id))
      return reply.code(403).send({ error: "No access" });
    const replies = db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.parentId, id))
      .orderBy(messages.id)
      .all();
    return {
      parent: loadMessage(id),
      replies: loadMessages(replies.map((r) => r.id)),
    };
  });

  // create a message (channel or DM, optionally a thread reply)
  app.post("/api/messages", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const user = currentUser(req);
    const { channelId, dmId, parentId, body, attachmentIds } = parsed.data;

    if (!channelId && !dmId)
      return reply.code(400).send({ error: "channelId or dmId required" });
    if (!body.trim() && (!attachmentIds || attachmentIds.length === 0))
      return reply.code(400).send({ error: "Message is empty" });
    if (channelId && !canSeeChannel(channelId, user.id))
      return reply.code(403).send({ error: "No access" });
    if (dmId && !canSeeDm(dmId, user.id))
      return reply.code(403).send({ error: "No access" });

    const message = createMessageRecord({
      userId: user.id,
      channelId: channelId ?? null,
      dmId: dmId ?? null,
      parentId: parentId ?? null,
      body,
      attachmentIds,
    });
    return { message };
  });

  app.patch("/api/messages/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const parsed = editMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const msg = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg) return reply.code(404).send({ error: "Not found" });
    if (msg.userId !== user.id) return reply.code(403).send({ error: "Not your message" });
    db.update(messages)
      .set({ body: parsed.data.body, editedAt: new Date().toISOString() })
      .where(eq(messages.id, id))
      .run();
    const full = loadMessage(id)!;
    if (msg.channelId) emitToChannel(msg.channelId, SocketEvents.MessageEdit, full);
    else if (msg.dmId) emitToDm(msg.dmId, SocketEvents.MessageEdit, full);
    return { message: full };
  });

  app.delete("/api/messages/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const msg = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg) return reply.code(404).send({ error: "Not found" });
    if (msg.userId !== user.id && user.role !== "admin")
      return reply.code(403).send({ error: "Not allowed" });
    db.update(messages)
      .set({ deletedAt: new Date().toISOString(), body: "" })
      .where(eq(messages.id, id))
      .run();
    const payload = { id, channelId: msg.channelId, dmId: msg.dmId };
    if (msg.channelId) emitToChannel(msg.channelId, SocketEvents.MessageDelete, payload);
    else if (msg.dmId) emitToDm(msg.dmId, SocketEvents.MessageDelete, payload);
    return { ok: true };
  });

  // toggle a reaction
  app.post("/api/messages/:id/react", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const parsed = toggleReactionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const msg = db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg) return reply.code(404).send({ error: "Not found" });
    const { emoji } = parsed.data;
    const existing = db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, id),
          eq(reactions.userId, user.id),
          eq(reactions.emoji, emoji),
        ),
      )
      .get();
    let event: string;
    if (existing) {
      db.delete(reactions)
        .where(
          and(
            eq(reactions.messageId, id),
            eq(reactions.userId, user.id),
            eq(reactions.emoji, emoji),
          ),
        )
        .run();
      event = SocketEvents.ReactionRemove;
    } else {
      db.insert(reactions).values({ messageId: id, userId: user.id, emoji }).run();
      event = SocketEvents.ReactionAdd;
    }
    const full = loadMessage(id)!;
    const payload = { messageId: id, message: full };
    if (msg.channelId) emitToChannel(msg.channelId, event, payload);
    else if (msg.dmId) emitToDm(msg.dmId, event, payload);
    return { message: full };
  });
}
