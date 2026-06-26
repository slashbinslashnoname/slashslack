import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { bans, users } from "../db/schema.js";
import { getUserById } from "../auth.js";

export function isIpBanned(ip: string | undefined): boolean {
  if (!ip) return false;
  return !!db.select().from(bans).where(eq(bans.ip, ip)).get();
}
export function isDeviceBanned(device: string | null | undefined): boolean {
  if (!device) return false;
  return !!db.select().from(bans).where(eq(bans.device, device)).get();
}
export function isEmailBanned(email: string): boolean {
  return !!db.select().from(bans).where(eq(bans.email, email.toLowerCase())).get();
}

/** True if a login/registration attempt should be blocked. */
export function isBlocked(opts: { email?: string; ip?: string; device?: string | null }): boolean {
  if (opts.email && isEmailBanned(opts.email)) return true;
  if (isIpBanned(opts.ip)) return true;
  if (isDeviceBanned(opts.device)) return true;
  return false;
}

/** Ban a user: mark the account and blocklist their email + last IP + device. */
export function banUser(userId: number, reason?: string) {
  const u = getUserById(userId);
  if (!u) return;
  db.update(users).set({ banned: true }).where(eq(users.id, userId)).run();
  db.insert(bans)
    .values({
      userId,
      email: u.email.toLowerCase(),
      ip: u.lastIp ?? null,
      device: u.lastDevice ?? null,
      reason: reason ?? null,
    })
    .run();
}

export function unbanUser(userId: number) {
  db.update(users).set({ banned: false }).where(eq(users.id, userId)).run();
  db.delete(bans).where(eq(bans.userId, userId)).run();
}
