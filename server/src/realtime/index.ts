import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { and, eq } from "drizzle-orm";
import { SocketEvents } from "@slashslack/shared";
import { db } from "../db/index.js";
import { channelMembers, channels, dmMembers } from "../db/schema.js";
import { consumeSocketToken } from "./tokens.js";
import { presence } from "../presence.js";
import { getUserById, toPublicUser } from "../auth.js";

let io: Server;

function roomsForUser(userId: number): string[] {
  const rooms = [`user:${userId}`];
  // all public channels are visible to everyone
  const publicChannels = db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.isPrivate, false))
    .all();
  for (const c of publicChannels) rooms.push(`channel:${c.id}`);
  // private channels the user belongs to
  const memberOf = db
    .select({ id: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.userId, userId))
    .all();
  for (const c of memberOf) rooms.push(`channel:${c.id}`);
  // DM conversations
  const dms = db
    .select({ id: dmMembers.dmId })
    .from(dmMembers)
    .where(eq(dmMembers.userId, userId))
    .all();
  for (const d of dms) rooms.push(`dm:${d.id}`);
  return [...new Set(rooms)];
}

export function initRealtime(server: HttpServer) {
  // Same-origin in production (single container). Reflect only in dev where the
  // Vite dev server proxies the socket. The handshake is token-authenticated.
  const corsOrigin =
    process.env.NODE_ENV === "production"
      ? process.env.PUBLIC_ORIGIN || false
      : true;
  io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const userId = token ? consumeSocketToken(token) : null;
    if (!userId) return next(new Error("unauthorized"));
    (socket.data as any).userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = (socket.data as any).userId as number;
    for (const room of roomsForUser(userId)) socket.join(room);

    const becameOnline = presence.connect(userId);
    if (becameOnline) {
      const u = getUserById(userId);
      if (u) io.emit(SocketEvents.PresenceUpdate, toPublicUser(u));
    }

    socket.on(SocketEvents.TypingStart, (p: { channelId?: number; dmId?: number }) => {
      const u = getUserById(userId);
      if (!u) return;
      const payload = {
        channelId: p.channelId ?? null,
        dmId: p.dmId ?? null,
        user: toPublicUser(u),
      };
      const room = p.channelId ? `channel:${p.channelId}` : `dm:${p.dmId}`;
      socket.to(room).emit(SocketEvents.Typing, payload);
    });

    socket.on("disconnect", () => {
      const wentOffline = presence.disconnect(userId);
      if (wentOffline) {
        const u = getUserById(userId);
        if (u) {
          const pub = toPublicUser(u);
          io.emit(SocketEvents.PresenceUpdate, { ...pub, status: "offline" });
        }
      }
    });
  });

  return io;
}

export function getIo() {
  return io;
}

/* ----------------------------- emit helpers ----------------------------- */

export function emitToChannel(channelId: number, event: string, payload: unknown) {
  io?.to(`channel:${channelId}`).emit(event, payload);
}
export function emitToDm(dmId: number, event: string, payload: unknown) {
  io?.to(`dm:${dmId}`).emit(event, payload);
}
export function emitToUser(userId: number, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
export function broadcast(event: string, payload: unknown) {
  io?.emit(event, payload);
}

/** Make every connected socket join a (new public) channel room. */
export function joinAllToChannel(channelId: number) {
  io?.sockets.sockets.forEach((s) => s.join(`channel:${channelId}`));
}

/** Add specific members' sockets to a room (private channel / DM). */
export function joinUsersToRoom(userIds: number[], room: string) {
  io?.sockets.sockets.forEach((s) => {
    const uid = (s.data as any).userId as number;
    if (userIds.includes(uid)) s.join(room);
  });
}
