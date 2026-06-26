import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { currentUser, requireAdmin } from "../auth.js";
import { banUser, unbanUser } from "../services/bans.js";
import { disconnectUser } from "../realtime/index.js";

export async function adminRoutes(app: FastifyInstance) {
  // member directory with moderation info (admin only)
  app.get("/api/admin/users", { preHandler: requireAdmin }, async () => {
    const rows = db
      .select()
      .from(users)
      .where(eq(users.isBot, false))
      .orderBy(asc(users.displayName))
      .all();
    return {
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role,
        banned: u.banned,
        lastIp: u.lastIp,
        createdAt: u.createdAt,
      })),
    };
  });

  // ban a user (blocks their email + last IP + device, kills their sessions)
  app.post("/api/admin/users/:id/ban", { preHandler: requireAdmin }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const me = currentUser(req);
    if (id === me.id) return reply.code(400).send({ error: "You can't ban yourself" });
    const target = db.select().from(users).where(eq(users.id, id)).get();
    if (!target) return reply.code(404).send({ error: "Not found" });
    if (target.role === "admin") return reply.code(403).send({ error: "Can't ban an admin" });
    const { reason } = (req.body as { reason?: string }) || {};
    banUser(id, reason);
    disconnectUser(id);
    return { ok: true };
  });

  app.post("/api/admin/users/:id/unban", { preHandler: requireAdmin }, async (req) => {
    const id = Number((req.params as any).id);
    unbanUser(id);
    return { ok: true };
  });
}
