import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import {
  SocketEvents,
  createCategorySchema,
  createChannelSchema,
  reorderSchema,
  updateChannelSchema,
} from "@slashslack/shared";
import { db, raw } from "../db/index.js";
import { categories, channelMembers, channels } from "../db/schema.js";
import { currentUser, requireAdmin, requireAuth } from "../auth.js";
import {
  broadcast,
  emitToChannel,
  joinAllToChannel,
  joinUsersToRoom,
} from "../realtime/index.js";
import {
  addAllUsersToChannel,
  ensureMembership,
  isMember,
  listChannelsForUser,
} from "../services/channels.js";

export async function channelRoutes(app: FastifyInstance) {
  // ---- categories ----
  app.get("/api/categories", { preHandler: requireAuth }, async () => {
    return {
      categories: db
        .select()
        .from(categories)
        .orderBy(asc(categories.position), asc(categories.id))
        .all(),
    };
  });

  app.post("/api/categories", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const count = db.select().from(categories).all().length;
    const cat = db
      .insert(categories)
      .values({ ...parsed.data, position: count })
      .returning()
      .get();
    broadcast(SocketEvents.CategoryChanged, {});
    return { category: cat };
  });

  app.patch("/api/categories/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = req.body as { name?: string; icon?: string };
    db.update(categories)
      .set({ ...(body.name ? { name: body.name } : {}), ...(body.icon ? { icon: body.icon } : {}) })
      .where(eq(categories.id, id))
      .run();
    broadcast(SocketEvents.CategoryChanged, {});
    return { ok: true };
  });

  app.delete("/api/categories/:id", { preHandler: requireAdmin }, async (req) => {
    const id = Number((req.params as any).id);
    db.update(channels).set({ categoryId: null }).where(eq(channels.categoryId, id)).run();
    db.delete(categories).where(eq(categories.id, id)).run();
    broadcast(SocketEvents.CategoryChanged, {});
    return { ok: true };
  });

  app.post("/api/categories/reorder", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    parsed.data.ids.forEach((id, i) => {
      db.update(categories).set({ position: i }).where(eq(categories.id, id)).run();
    });
    broadcast(SocketEvents.ChannelReordered, {});
    return { ok: true };
  });

  // ---- channels ----
  app.get("/api/channels", { preHandler: requireAuth }, async (req) => {
    return { channels: listChannelsForUser(currentUser(req).id) };
  });

  app.post("/api/channels", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createChannelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const user = currentUser(req);
    const count = db.select().from(channels).all().length;
    const channel = db
      .insert(channels)
      .values({
        name: parsed.data.name,
        topic: parsed.data.topic,
        icon: parsed.data.icon,
        isPrivate: parsed.data.isPrivate,
        categoryId: parsed.data.categoryId ?? null,
        position: count,
        createdBy: user.id,
      })
      .returning()
      .get();

    if (channel.isPrivate) {
      ensureMembership(channel.id, user.id, "owner");
      joinUsersToRoom([user.id], `channel:${channel.id}`);
    } else {
      addAllUsersToChannel(channel.id);
      joinAllToChannel(channel.id);
    }
    broadcast(SocketEvents.ChannelCreated, { id: channel.id });
    return { channel };
  });

  app.patch("/api/channels/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const parsed = updateChannelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    // only admins may toggle promotion / move categories; members may edit topic of channels they belong to
    const isAdmin = user.role === "admin";
    if (!isAdmin && (parsed.data.isPromoted !== undefined))
      return reply.code(403).send({ error: "Admin only" });
    db.update(channels).set(parsed.data).where(eq(channels.id, id)).run();
    broadcast(SocketEvents.ChannelUpdated, { id });
    return { ok: true };
  });

  app.post("/api/channels/reorder", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    parsed.data.ids.forEach((id, i) => {
      db.update(channels)
        .set({
          position: i,
          ...(parsed.data.categoryId !== undefined
            ? { categoryId: parsed.data.categoryId }
            : {}),
        })
        .where(eq(channels.id, id))
        .run();
    });
    broadcast(SocketEvents.ChannelReordered, {});
    return { ok: true };
  });

  // join a public channel explicitly (members list / invites)
  app.post("/api/channels/:id/join", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const ch = db.select().from(channels).where(eq(channels.id, id)).get();
    if (!ch) return reply.code(404).send({ error: "Not found" });
    if (ch.isPrivate && !isMember(id, user.id))
      return reply.code(403).send({ error: "Private channel" });
    ensureMembership(id, user.id);
    return { ok: true };
  });

  // toggle a personal favorite ("promoted") channel — per user
  app.post("/api/channels/:id/favorite", { preHandler: requireAuth }, async (req) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const existing = raw
      .prepare("SELECT 1 FROM user_channel_favorites WHERE user_id = ? AND channel_id = ?")
      .get(user.id, id);
    if (existing) {
      raw.prepare("DELETE FROM user_channel_favorites WHERE user_id = ? AND channel_id = ?").run(user.id, id);
      return { favorite: false };
    }
    raw.prepare("INSERT INTO user_channel_favorites (user_id, channel_id) VALUES (?, ?)").run(user.id, id);
    return { favorite: true };
  });

  // save the user's personal sidebar layout (overrides admin defaults, per user)
  app.post("/api/channels/layout", { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req);
    const body = req.body as {
      items?: { channelId: number; categoryId: number | null; position: number }[];
    };
    if (!Array.isArray(body.items)) return reply.code(400).send({ error: "items required" });
    const stmt = raw.prepare(
      `INSERT INTO user_channel_layout (user_id, channel_id, category_id, position)
       VALUES (@uid, @cid, @cat, @pos)
       ON CONFLICT(user_id, channel_id)
       DO UPDATE SET category_id = @cat, position = @pos`,
    );
    const tx = raw.transaction((items: typeof body.items) => {
      for (const it of items!)
        stmt.run({ uid: user.id, cid: it.channelId, cat: it.categoryId, pos: it.position });
    });
    tx(body.items);
    return { ok: true };
  });

  // reset the user's personal layout back to the admin default
  app.delete("/api/channels/layout", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    raw.prepare("DELETE FROM user_channel_layout WHERE user_id = ?").run(user.id);
    return { ok: true };
  });

  // mark channel as read up to latest message
  app.post("/api/channels/:id/read", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const row = db.select().from(channels).where(eq(channels.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    ensureMembership(id, user.id);
    const r = raw
      .prepare("SELECT COALESCE(MAX(id),0) AS m FROM messages WHERE channel_id = ?")
      .get(id) as { m: number };
    db.update(channelMembers)
      .set({ lastReadMessageId: r.m })
      .where(and(eq(channelMembers.channelId, id), eq(channelMembers.userId, user.id)))
      .run();
    emitToChannel(id, SocketEvents.ReceiptUpdate, {
      channelId: id,
      userId: user.id,
      lastReadMessageId: r.m,
    });
    return { ok: true, lastRead: r.m };
  });
}
