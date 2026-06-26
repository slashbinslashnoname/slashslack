import { raw } from "../db/index.js";
import { loadMessages } from "../lib/serialize.js";
import { buildFtsQuery } from "../lib/text.js";
import type { Message } from "@slashslack/shared";

/**
 * Full-text search across message bodies the user is allowed to see.
 * Visibility: public channels + private channels/DMs the user belongs to.
 */
export function searchMessages(userId: number, query: string, limit = 40): Message[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const ftsQuery = buildFtsQuery(trimmed);

  const rows = raw
    .prepare(
      `
      SELECT m.id AS id
      FROM messages_fts f
      JOIN messages m ON m.id = f.rowid
      LEFT JOIN channels c ON c.id = m.channel_id
      WHERE messages_fts MATCH @q
        AND m.deleted_at IS NULL
        AND (
          (m.channel_id IS NOT NULL AND (
            c.is_private = 0
            OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = m.channel_id AND cm.user_id = @uid)
          ))
          OR (m.dm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM dm_members dm WHERE dm.dm_id = m.dm_id AND dm.user_id = @uid
          ))
        )
      ORDER BY rank
      LIMIT @limit
    `,
    )
    .all({ q: ftsQuery, uid: userId, limit }) as { id: number }[];

  return loadMessages(rows.map((r) => r.id));
}
