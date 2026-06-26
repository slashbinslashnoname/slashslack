import type { FastifyInstance, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { channels, channelWebhooks } from "../db/schema.js";
import { currentUser, requireAuth } from "../auth.js";
import { isMember } from "../services/channels.js";
import { createMessageRecord } from "../services/messages.js";

function origin(req: FastifyRequest): string {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  return `${proto}://${req.headers.host}`;
}
const hookUrl = (req: FastifyRequest, token: string) => `${origin(req)}/api/webhooks/${token}`;

export async function webhookRoutes(app: FastifyInstance) {
  function canManage(channelId: number, userId: number, role: string) {
    const ch = db.select().from(channels).where(eq(channels.id, channelId)).get();
    if (!ch) return false;
    return role === "admin" || !ch.isPrivate || isMember(channelId, userId);
  }

  app.get("/api/channels/:id/webhooks", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canManage(id, user.id, user.role)) return reply.code(403).send({ error: "No access" });
    const rows = db
      .select()
      .from(channelWebhooks)
      .where(eq(channelWebhooks.channelId, id))
      .orderBy(desc(channelWebhooks.id))
      .all();
    return { webhooks: rows.map((w) => ({ id: w.id, name: w.name, url: hookUrl(req, w.token), createdAt: w.createdAt })) };
  });

  app.post("/api/channels/:id/webhooks", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    if (!canManage(id, user.id, user.role)) return reply.code(403).send({ error: "No access" });
    const parsed = z.object({ name: z.string().min(1).max(60).optional() }).safeParse(req.body);
    const name = parsed.success && parsed.data.name ? parsed.data.name : "Webhook";
    const token = nanoid(40);
    const row = db
      .insert(channelWebhooks)
      .values({ channelId: id, token, name, createdBy: user.id })
      .returning()
      .get();
    return { webhook: { id: row.id, name: row.name, url: hookUrl(req, token), createdAt: row.createdAt } };
  });

  app.delete("/api/webhooks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const user = currentUser(req);
    const wh = db.select().from(channelWebhooks).where(eq(channelWebhooks.id, id)).get();
    if (!wh) return reply.code(404).send({ error: "Not found" });
    if (wh.createdBy !== user.id && user.role !== "admin")
      return reply.code(403).send({ error: "Not allowed" });
    db.delete(channelWebhooks).where(eq(channelWebhooks.id, id)).run();
    return { ok: true };
  });

  // Incoming webhook — authenticated by the secret token only (no session).
  app.post("/api/webhooks/:token", async (req, reply) => {
    const token = (req.params as any).token as string;
    const wh = db.select().from(channelWebhooks).where(eq(channelWebhooks.token, token)).get();
    if (!wh) return reply.code(404).send({ error: "Invalid webhook token" });
    const parsed = z
      .object({ text: z.string().min(1).max(8000), username: z.string().max(60).optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Body must be { text: string }" });
    const body = parsed.data.username ? `**${parsed.data.username}:** ${parsed.data.text}` : parsed.data.text;
    const message = createMessageRecord({ userId: wh.createdBy, channelId: wh.channelId, body });
    return { ok: true, messageId: message.id };
  });
}
