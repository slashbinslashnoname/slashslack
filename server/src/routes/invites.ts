import type { FastifyInstance, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createInviteSchema, type Invite } from "@slashslack/shared";
import { db, getSettings } from "../db/index.js";
import { invites, users } from "../db/schema.js";
import { currentUser, requireAdmin } from "../auth.js";
import { inviteEmail, mailerConfigured, sendMail } from "../services/mailer.js";

function originFor(req: FastifyRequest): string {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  return `${proto}://${req.headers.host}`;
}

function inviteUrl(req: FastifyRequest, token: string) {
  return `${originFor(req)}/?invite=${token}`;
}

export async function inviteRoutes(app: FastifyInstance) {
  // create + email an invite (admin only)
  app.post("/api/invites", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid email" });
    const email = parsed.data.email.toLowerCase();
    const user = currentUser(req);

    const existingUser = db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) return reply.code(409).send({ error: "That email already has an account" });

    const token = nanoid(24);
    const row = db
      .insert(invites)
      .values({ email, token, invitedBy: user.id })
      .returning()
      .get();

    const url = inviteUrl(req, token);
    const settings = getSettings();
    const { text, html } = inviteEmail(settings.appName, user.displayName, url);
    const result = await sendMail({
      to: email,
      subject: `You're invited to ${settings.appName}`,
      text,
      html,
    });

    const invite: Invite = {
      id: row.id,
      email: row.email,
      token: row.token,
      acceptedAt: row.acceptedAt,
      createdAt: row.createdAt,
      inviteUrl: url,
    };
    return { invite, emailed: result.sent, emailError: result.error ?? null };
  });

  // list pending/sent invites (admin)
  app.get("/api/invites", { preHandler: requireAdmin }, async (req) => {
    const rows = db.select().from(invites).orderBy(desc(invites.id)).all();
    return {
      invites: rows.map((r) => ({
        id: r.id,
        email: r.email,
        token: r.token,
        acceptedAt: r.acceptedAt,
        createdAt: r.createdAt,
        inviteUrl: inviteUrl(req, r.token),
      })),
      mailerConfigured: mailerConfigured(),
    };
  });

  // revoke an invite (admin)
  app.delete("/api/invites/:id", { preHandler: requireAdmin }, async (req) => {
    const id = Number((req.params as any).id);
    db.delete(invites).where(eq(invites.id, id)).run();
    return { ok: true };
  });

  // public: look up an invite by token (to prefill the signup form)
  app.get("/api/invites/by-token/:token", async (req, reply) => {
    const token = (req.params as any).token as string;
    const row = db
      .select()
      .from(invites)
      .where(eq(invites.token, token))
      .get();
    if (!row || row.acceptedAt) return reply.code(404).send({ error: "Invalid or used invite" });
    return { email: row.email };
  });
}
