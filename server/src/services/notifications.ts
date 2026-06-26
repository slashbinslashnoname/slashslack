import { eq } from "drizzle-orm";
import type { AppNotification, NotificationType } from "@slashslack/shared";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { getUserById, toPublicUser } from "../auth.js";
import { emitToUser } from "../realtime/index.js";
import { SocketEvents } from "@slashslack/shared";

export { parseMentions, hasBroadcastMention, plainPreview } from "../lib/text.js";

interface NotifyArgs {
  userId: number;
  type: NotificationType;
  actorId: number;
  channelId?: number | null;
  dmId?: number | null;
  messageId?: number | null;
  preview: string;
}

export function createNotification(args: NotifyArgs) {
  if (args.userId === args.actorId) return; // never notify yourself
  const row = db
    .insert(notifications)
    .values({
      userId: args.userId,
      type: args.type,
      actorId: args.actorId,
      channelId: args.channelId ?? null,
      dmId: args.dmId ?? null,
      messageId: args.messageId ?? null,
      preview: args.preview,
      read: false,
    })
    .returning()
    .get();

  const actor = args.actorId ? getUserById(args.actorId) : null;
  const payload: AppNotification = {
    id: row.id,
    type: row.type as NotificationType,
    read: false,
    createdAt: row.createdAt,
    actor: actor ? toPublicUser(actor) : null,
    channelId: row.channelId,
    dmId: row.dmId,
    messageId: row.messageId,
    preview: row.preview,
  };
  emitToUser(args.userId, SocketEvents.NotificationNew, payload);
}

export function serializeNotification(row: typeof notifications.$inferSelect): AppNotification {
  const actor = row.actorId ? getUserById(row.actorId) : null;
  return {
    id: row.id,
    type: row.type as NotificationType,
    read: row.read,
    createdAt: row.createdAt,
    actor: actor ? toPublicUser(actor) : null,
    channelId: row.channelId,
    dmId: row.dmId,
    messageId: row.messageId,
    preview: row.preview,
  };
}
