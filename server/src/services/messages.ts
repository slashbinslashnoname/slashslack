import { and, eq, inArray, ne } from "drizzle-orm";
import { SocketEvents } from "@slashslack/shared";
import { db } from "../db/index.js";
import {
  attachments,
  channelMembers,
  channels,
  dmMembers,
  messages,
} from "../db/schema.js";
import { loadMessage } from "../lib/serialize.js";
import { emitToChannel, emitToDm } from "../realtime/index.js";
import { unfurlMessage } from "./unfurl.js";
import {
  createNotification,
  hasBroadcastMention,
  parseMentions,
  plainPreview,
} from "./notifications.js";

interface CreateArgs {
  userId: number;
  channelId?: number | null;
  dmId?: number | null;
  parentId?: number | null;
  body: string;
  attachmentIds?: number[];
}

export function createMessageRecord(args: CreateArgs) {
  const row = db
    .insert(messages)
    .values({
      channelId: args.channelId ?? null,
      dmId: args.dmId ?? null,
      parentId: args.parentId ?? null,
      userId: args.userId,
      body: args.body,
    })
    .returning()
    .get();

  // bind any uploaded attachments to this message
  if (args.attachmentIds && args.attachmentIds.length) {
    db.update(attachments)
      .set({ messageId: row.id })
      .where(
        and(
          inArray(attachments.id, args.attachmentIds),
          eq(attachments.uploaderId, args.userId),
        ),
      )
      .run();
  }

  // sender has implicitly read their own message
  if (args.channelId) {
    db.update(channelMembers)
      .set({ lastReadMessageId: row.id })
      .where(
        and(
          eq(channelMembers.channelId, args.channelId),
          eq(channelMembers.userId, args.userId),
        ),
      )
      .run();
  } else if (args.dmId) {
    db.update(dmMembers)
      .set({ lastReadMessageId: row.id })
      .where(and(eq(dmMembers.dmId, args.dmId), eq(dmMembers.userId, args.userId)))
      .run();
  }

  const full = loadMessage(row.id)!;

  // realtime fan-out
  if (args.channelId) {
    emitToChannel(args.channelId, SocketEvents.MessageNew, full);
  } else if (args.dmId) {
    emitToDm(args.dmId, SocketEvents.MessageNew, full);
  }

  // notifications (best-effort, synchronous is fine for SQLite)
  dispatchNotifications(args, row.id);

  // OG unfurl asynchronously
  void unfurlMessage(row.id, args.body);

  return full;
}

function dispatchNotifications(args: CreateArgs, messageId: number) {
  const preview = plainPreview(args.body || "Shared a file");
  const notified = new Set<number>();

  // explicit @mentions
  for (const uid of parseMentions(args.body)) {
    notified.add(uid);
    createNotification({
      userId: uid,
      actorId: args.userId,
      type: "mention",
      channelId: args.channelId ?? null,
      dmId: args.dmId ?? null,
      messageId,
      preview,
    });
  }

  // @channel / @everyone / @here — notify every channel member
  if (args.channelId && hasBroadcastMention(args.body)) {
    const members = db
      .select({ userId: channelMembers.userId })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, args.channelId),
          ne(channelMembers.userId, args.userId),
        ),
      )
      .all();
    for (const m of members) {
      if (notified.has(m.userId)) continue;
      notified.add(m.userId);
      createNotification({
        userId: m.userId,
        actorId: args.userId,
        type: "mention",
        channelId: args.channelId,
        messageId,
        preview,
      });
    }
  }

  // thread reply notifies the parent author
  if (args.parentId) {
    const parent = db
      .select({ userId: messages.userId })
      .from(messages)
      .where(eq(messages.id, args.parentId))
      .get();
    if (parent && !notified.has(parent.userId)) {
      notified.add(parent.userId);
      createNotification({
        userId: parent.userId,
        actorId: args.userId,
        type: "thread_reply",
        channelId: args.channelId ?? null,
        dmId: args.dmId ?? null,
        messageId,
        preview,
      });
    }
  }

  // DM notifies all other participants
  if (args.dmId) {
    const members = db
      .select({ userId: dmMembers.userId })
      .from(dmMembers)
      .where(and(eq(dmMembers.dmId, args.dmId), ne(dmMembers.userId, args.userId)))
      .all();
    for (const m of members) {
      if (notified.has(m.userId)) continue;
      createNotification({
        userId: m.userId,
        actorId: args.userId,
        type: "dm",
        dmId: args.dmId,
        messageId,
        preview,
      });
    }
  }
}
