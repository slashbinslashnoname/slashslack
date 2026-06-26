import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { currentUser, requireAuth } from "../auth.js";
import { serializeNotification } from "../services/notifications.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/api/notifications", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const rows = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.id))
      .limit(50)
      .all();
    return { notifications: rows.map(serializeNotification) };
  });

  app.post("/api/notifications/read", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const { id, channelId, dmId } = (req.body as { id?: number; channelId?: number; dmId?: number }) || {};
    const own = eq(notifications.userId, user.id);
    if (id) {
      db.update(notifications).set({ read: true }).where(and(own, eq(notifications.id, id))).run();
    } else if (channelId) {
      db.update(notifications).set({ read: true }).where(and(own, eq(notifications.channelId, channelId))).run();
    } else if (dmId) {
      db.update(notifications).set({ read: true }).where(and(own, eq(notifications.dmId, dmId))).run();
    } else {
      db.update(notifications).set({ read: true }).where(own).run();
    }
    return { ok: true };
  });
}
