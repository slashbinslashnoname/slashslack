import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Message, PublicUser } from "@slashslack/shared";
import { db } from "../db/index.js";
import {
  attachments,
  linkPreviews,
  messages,
  reactions,
  users,
} from "../db/schema.js";
import { toPublicUser } from "../auth.js";

export function fileUrl(p: string | null): string | null {
  return p ? `/uploads/${p}` : null;
}

/** Hydrate a set of messages by id into full client-facing Message objects. */
export function loadMessages(ids: number[]): Message[] {
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(messages)
    .where(inArray(messages.id, ids))
    .all();

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows = userIds.length
    ? db.select().from(users).where(inArray(users.id, userIds)).all()
    : [];
  const userMap = new Map<number, PublicUser>(
    userRows.map((u) => [u.id, toPublicUser(u)]),
  );

  const atts = db
    .select()
    .from(attachments)
    .where(inArray(attachments.messageId, ids))
    .all();
  const previews = db
    .select()
    .from(linkPreviews)
    .where(inArray(linkPreviews.messageId, ids))
    .all();
  const reacts = db
    .select()
    .from(reactions)
    .where(inArray(reactions.messageId, ids))
    .all();

  // reply counts grouped by parent
  const replyRows = db
    .select({
      parentId: messages.parentId,
      count: sql<number>`count(*)`,
      last: sql<string>`max(created_at)`,
    })
    .from(messages)
    .where(and(inArray(messages.parentId, ids), isNull(messages.deletedAt)))
    .groupBy(messages.parentId)
    .all();
  const replyMap = new Map(replyRows.map((r) => [r.parentId, r]));

  const out: Message[] = rows.map((m) => {
    const reactMap = new Map<string, { count: number; userIds: number[] }>();
    for (const r of reacts.filter((x) => x.messageId === m.id)) {
      const entry = reactMap.get(r.emoji) || { count: 0, userIds: [] };
      entry.count++;
      entry.userIds.push(r.userId);
      reactMap.set(r.emoji, entry);
    }
    const reply = replyMap.get(m.id);
    return {
      id: m.id,
      channelId: m.channelId,
      dmId: m.dmId,
      parentId: m.parentId,
      user: userMap.get(m.userId) || {
        id: m.userId,
        email: "",
        displayName: "Unknown",
        avatarUrl: null,
        role: "member",
        status: "offline",
        statusText: null,
      },
      body: m.deletedAt ? "" : m.body,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      pinnedAt: m.pinnedAt ?? null,
      attachments: m.deletedAt
        ? []
        : atts
            .filter((a) => a.messageId === m.id)
            .map((a) => ({
              id: a.id,
              messageId: a.messageId,
              filename: a.filename,
              mime: a.mime,
              size: a.size,
              width: a.width,
              height: a.height,
              url: fileUrl(a.storagePath)!,
              thumbUrl: fileUrl(a.thumbPath),
            })),
      previews: m.deletedAt
        ? []
        : previews
            .filter((p) => p.messageId === m.id)
            .map((p) => ({
              id: p.id,
              messageId: p.messageId,
              url: p.url,
              title: p.title,
              description: p.description,
              image: p.image,
              siteName: p.siteName,
            })),
      reactions: [...reactMap.entries()].map(([emoji, v]) => ({
        emoji,
        count: v.count,
        userIds: v.userIds,
      })),
      replyCount: reply?.count ?? 0,
      lastReplyAt: reply?.last ?? null,
    };
  });

  // preserve input order
  const byId = new Map(out.map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

export function loadMessage(id: number): Message | null {
  return loadMessages([id])[0] || null;
}
