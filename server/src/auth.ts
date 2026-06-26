import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import argon2 from "argon2";
import type { PublicUser } from "@slashslack/shared";
import { db } from "./db/index.js";
import { users } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { presence } from "./presence.js";

declare module "@fastify/secure-session" {
  interface SessionData {
    userId: number;
  }
}

export function hashPassword(pw: string) {
  return argon2.hash(pw);
}
export async function verifyPassword(hash: string, pw: string) {
  try {
    return await argon2.verify(hash, pw);
  } catch {
    // malformed/disabled hash (e.g. bot accounts) → never authenticate
    return false;
  }
}

export function toPublicUser(u: {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  statusText?: string | null;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role as PublicUser["role"],
    status: presence.isOnline(u.id) ? "online" : "offline",
    statusText: u.statusText ?? null,
  };
}

export function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Resolve the logged-in user or 401. Attaches `req.user`. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.session.get("userId");
  if (!userId) return reply.code(401).send({ error: "Not authenticated" });
  const user = getUserById(userId);
  if (!user) {
    req.session.delete();
    return reply.code(401).send({ error: "Not authenticated" });
  }
  (req as any).user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if ((req as any).user.role !== "admin") {
    return reply.code(403).send({ error: "Admin only" });
  }
}

export function currentUser(req: FastifyRequest) {
  return (req as any).user as ReturnType<typeof getUserById> & object;
}

export function registerAuthDecorators(app: FastifyInstance) {
  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);
}
