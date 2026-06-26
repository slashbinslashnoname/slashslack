import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDmSchema } from "@slashslack/shared";
import type { DmConversation } from "@slashslack/shared";
import { db, raw } from "../db/index.js";
import { dmConversations, dmMembers, users } from "../db/schema.js";
import { currentUser, requireAuth, toPublicUser } from "../auth.js";
import { emitToDm, joinUsersToRoom } from "../realtime/index.js";
import { SocketEvents } from "@slashslack/shared";

function serializeDm(id: number): DmConversation {
  const memberRows = db
    .select()
    .from(dmMembers)
    .innerJoin(users, eq(users.id, dmMembers.userId))
    .where(eq(dmMembers.dmId, id))
    .all();
  return {
    id,
    members: memberRows.map((r) => toPublicUser(r.users)),
  };
}

export async function dmRoutes(app: FastifyInstance) {
  app.get("/api/dms", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const rows = db
      .select({ id: dmMembers.dmId })
      .from(dmMembers)
      .where(eq(dmMembers.userId, user.id))
      .all();
    const list = rows.map((r) => {
      const dm = serializeDm(r.id);
      const stats = raw
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM messages m
                WHERE m.dm_id = @dm AND m.parent_id IS NULL AND m.deleted_at IS NULL
                  AND m.user_id != @uid AND m.id > dm.last_read_message_id) AS unread,
             dm.last_read_message_id AS last_read
           FROM dm_members dm WHERE dm.dm_id = @dm AND dm.user_id = @uid`,
        )
        .get({ uid: user.id, dm: r.id }) as { unread: number; last_read: number };
      return { ...dm, unread: stats.unread, lastRead: stats.last_read };
    });
    return { dms: list };
  });

  app.post("/api/dms", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createDmSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const user = currentUser(req);
    const memberIds = [...new Set([user.id, ...parsed.data.userIds])].sort((a, b) => a - b);
    const key = memberIds.join(",");

    let convo = db
      .select()
      .from(dmConversations)
      .where(eq(dmConversations.memberKey, key))
      .get();
    if (!convo) {
      convo = db.insert(dmConversations).values({ memberKey: key }).returning().get();
      for (const uid of memberIds) {
        db.insert(dmMembers).values({ dmId: convo.id, userId: uid }).run();
      }
      joinUsersToRoom(memberIds, `dm:${convo.id}`);
    }
    return { dm: serializeDm(convo.id) };
  });

  app.post("/api/dms/:id/read", { preHandler: requireAuth }, async (req) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const r = raw
      .prepare("SELECT COALESCE(MAX(id),0) AS m FROM messages WHERE dm_id = ?")
      .get(id) as { m: number };
    db.update(dmMembers)
      .set({ lastReadMessageId: r.m })
      .where(and(eq(dmMembers.dmId, id), eq(dmMembers.userId, user.id)))
      .run();
    emitToDm(id, SocketEvents.ReceiptUpdate, {
      dmId: id,
      userId: user.id,
      lastReadMessageId: r.m,
    });
    return { ok: true, lastRead: r.m };
  });
}
