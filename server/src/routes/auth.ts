import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema, registerSchema } from "@slashslack/shared";
import { db, getSettings } from "../db/index.js";
import { invites, users } from "../db/schema.js";
import {
  currentUser,
  hashPassword,
  requireAuth,
  toPublicUser,
  verifyPassword,
} from "../auth.js";
import { issueSocketToken } from "../realtime/tokens.js";
import { addUserToAllPublicChannels } from "../services/channels.js";

// stricter limit on credential endpoints to slow brute-force attempts
const authLimit = {
  config: { rateLimit: { max: 15, timeWindow: "1 minute" } },
};

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", authLimit, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });

    const settings = getSettings();
    const userCount = db.select().from(users).all().length;
    const { email, password, displayName, inviteToken } = parsed.data;

    // validate an invite if one was supplied
    let invite = inviteToken
      ? db.select().from(invites).where(eq(invites.token, inviteToken)).get()
      : null;
    const validInvite = invite && !invite.acceptedAt;

    // gate registration: first user is always allowed (becomes admin);
    // afterwards, open registration OR a valid invite is required.
    if (userCount > 0 && !settings.allowRegistration && !validInvite) {
      return reply
        .code(403)
        .send({ error: "Registration is invite-only. Ask an admin for an invitation." });
    }
    if (validInvite && invite!.email.toLowerCase() !== email.toLowerCase()) {
      return reply.code(400).send({ error: "This invite is for a different email address." });
    }

    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) return reply.code(409).send({ error: "Email already in use" });

    const passwordHash = await hashPassword(password);
    const role = userCount === 0 ? "admin" : "member"; // first user is admin
    const user = db
      .insert(users)
      .values({ email, passwordHash, displayName, role })
      .returning()
      .get();

    addUserToAllPublicChannels(user.id);
    req.session.set("userId", user.id);
    return { user: toPublicUser(user) };
  });

  app.post("/api/auth/login", authLimit, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const { email, password } = parsed.data;
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !(await verifyPassword(user.passwordHash, password)))
      return reply.code(401).send({ error: "Invalid email or password" });
    req.session.set("userId", user.id);
    return { user: toPublicUser(user) };
  });

  app.post("/api/auth/logout", async (req) => {
    req.session.delete();
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return { user: toPublicUser(currentUser(req)) };
  });

  // Short-lived token used to authenticate the websocket handshake.
  app.get("/api/auth/socket", { preHandler: requireAuth }, async (req) => {
    return { token: issueSocketToken(currentUser(req).id) };
  });
}
