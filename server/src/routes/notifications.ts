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
    const { id } = (req.body as { id?: number }) || {};
    if (id) {
      db.update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
        .run();
    } else {
      db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, user.id))
        .run();
    }
    return { ok: true };
  });
}
