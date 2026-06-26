import { nanoid } from "nanoid";

/** Short-lived handshake tokens that map a socket connection to a user. */
const tokens = new Map<string, { userId: number; expires: number }>();
const TTL_MS = 60_000;

export function issueSocketToken(userId: number): string {
  const token = nanoid(32);
  tokens.set(token, { userId, expires: Date.now() + TTL_MS });
  return token;
}

export function consumeSocketToken(token: string): number | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token);
  if (entry.expires < Date.now()) return null;
  return entry.userId;
}
