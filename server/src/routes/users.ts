import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { SocketEvents } from "@slashslack/shared";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { currentUser, requireAuth, toPublicUser } from "../auth.js";
import { broadcast } from "../realtime/index.js";

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().nullable().optional(),
  statusText: z.string().max(100).nullable().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: requireAuth }, async () => {
    const rows = db.select().from(users).orderBy(asc(users.displayName)).all();
    return { users: rows.map(toPublicUser) };
  });

  // update your own profile (name, avatar)
  app.patch("/api/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const me = currentUser(req);
    db.update(users)
      .set({
        ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
        ...(parsed.data.statusText !== undefined ? { statusText: parsed.data.statusText } : {}),
      })
      .where(eq(users.id, me.id))
      .run();
    const updated = db.select().from(users).where(eq(users.id, me.id)).get()!;
    const pub = toPublicUser(updated);
    // refresh the user's name/avatar/status everywhere in real time
    broadcast(SocketEvents.UserUpdated, pub);
    return { user: pub };
  });
}
