import { and, eq, sql } from "drizzle-orm";
import type { Channel } from "@slashslack/shared";
import { db, raw } from "../db/index.js";
import { channelMembers, channels, dmMembers, messages, users } from "../db/schema.js";

function maxMessageId(channelId: number): number {
  const row = db
    .select({ m: sql<number>`coalesce(max(id), 0)` })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .get();
  return row?.m ?? 0;
}

/** Ensure a membership row exists (defaults last_read to the latest message). */
export function ensureMembership(channelId: number, userId: number, role = "member") {
  const existing = db
    .select()
    .from(channelMembers)
    .where(
      and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, userId),
      ),
    )
    .get();
  if (!existing) {
    db.insert(channelMembers)
      .values({
        channelId,
        userId,
        role,
        lastReadMessageId: maxMessageId(channelId),
      })
      .run();
  }
}

/** Add every user to a (public) channel. */
export function addAllUsersToChannel(channelId: number) {
  const all = db.select({ id: users.id }).from(users).all();
  for (const u of all) ensureMembership(channelId, u.id);
}

/** Add a brand-new user to every public channel. */
export function addUserToAllPublicChannels(userId: number) {
  const pub = db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.isPrivate, false))
    .all();
  for (const c of pub) ensureMembership(c.id, userId);
}

/** Can a user view a channel? (public, or a member of a private one) */
export function canSeeChannel(channelId: number, userId: number) {
  const ch = db.select().from(channels).where(eq(channels.id, channelId)).get();
  if (!ch) return false;
  return !ch.isPrivate || isMember(channelId, userId);
}

/** Is a user a participant of a DM conversation? */
export function canSeeDm(dmId: number, userId: number) {
  return !!db
    .select()
    .from(dmMembers)
    .where(and(eq(dmMembers.dmId, dmId), eq(dmMembers.userId, userId)))
    .get();
}

export function isMember(channelId: number, userId: number) {
  return !!db
    .select()
    .from(channelMembers)
    .where(
      and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, userId),
      ),
    )
    .get();
}

/** List channels visible to a user, with unread + mention flags. */
export function listChannelsForUser(userId: number): Channel[] {
  const rows = raw
    .prepare(
      `
      SELECT c.*,
        COALESCE(cm.last_read_message_id, 0) AS last_read,
        ucl.user_id AS has_override,
        ucl.category_id AS ovr_category,
        ucl.position AS ovr_position,
        (SELECT 1 FROM user_channel_favorites f WHERE f.channel_id = c.id AND f.user_id = @uid) AS is_fav,
        (SELECT COUNT(*) FROM messages m
           WHERE m.channel_id = c.id
             AND m.parent_id IS NULL
             AND m.deleted_at IS NULL
             AND m.user_id != @uid
             AND m.id > COALESCE(cm.last_read_message_id, 0)) AS unread,
        (SELECT COUNT(*) FROM notifications n
           WHERE n.user_id = @uid AND n.channel_id = c.id
             AND n.type = 'mention' AND n.read = 0) AS mentions
      FROM channels c
      LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = @uid
      LEFT JOIN user_channel_layout ucl ON ucl.channel_id = c.id AND ucl.user_id = @uid
      WHERE c.is_private = 0 OR cm.user_id IS NOT NULL
      ORDER BY
        CASE WHEN ucl.user_id IS NOT NULL THEN ucl.position ELSE c.position END ASC,
        c.id ASC
    `,
    )
    .all({ uid: userId }) as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    topic: r.topic,
    icon: r.icon,
    isPrivate: !!r.is_private,
    isPromoted: !!r.is_fav, // promoted/favorited is now per-user

    // personal layout override takes precedence over the admin default
    categoryId: r.has_override !== null ? r.ovr_category : r.category_id,
    position: r.has_override !== null ? r.ovr_position : r.position,
    createdBy: r.created_by,
    unread: r.unread,
    hasMention: r.mentions > 0,
    lastRead: r.last_read,
  }));
}
