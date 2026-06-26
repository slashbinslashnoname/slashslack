import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("member"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("folder"),
  position: integer("position").notNull().default(0),
});

export const channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  topic: text("topic").notNull().default(""),
  icon: text("icon").notNull().default("hash"),
  isPrivate: integer("is_private", { mode: "boolean" })
    .notNull()
    .default(false),
  isPromoted: integer("is_promoted", { mode: "boolean" })
    .notNull()
    .default(false),
  categoryId: integer("category_id"),
  position: integer("position").notNull().default(0),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const channelMembers = sqliteTable(
  "channel_members",
  {
    channelId: integer("channel_id").notNull(),
    userId: integer("user_id").notNull(),
    lastReadMessageId: integer("last_read_message_id").notNull().default(0),
    role: text("role").notNull().default("member"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) }),
);

export const dmConversations = sqliteTable("dm_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // sorted comma-joined user id key, used to dedupe 1:1 / group DMs
  memberKey: text("member_key").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const dmMembers = sqliteTable(
  "dm_members",
  {
    dmId: integer("dm_id").notNull(),
    userId: integer("user_id").notNull(),
    lastReadMessageId: integer("last_read_message_id").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.dmId, t.userId] }) }),
);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id"),
  dmId: integer("dm_id"),
  parentId: integer("parent_id"),
  userId: integer("user_id").notNull(),
  body: text("body").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  editedAt: text("edited_at"),
  deletedAt: text("deleted_at"),
  pinnedAt: text("pinned_at"),
  pinnedBy: integer("pinned_by"),
});

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    userId: integer("user_id").notNull(),
    messageId: integer("message_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.messageId] }) }),
);

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id"),
  uploaderId: integer("uploader_id").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  storagePath: text("storage_path").notNull(),
  thumbPath: text("thumb_path"),
});

export const linkPreviews = sqliteTable("link_previews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  image: text("image"),
  siteName: text("site_name"),
});

export const reactions = sqliteTable(
  "reactions",
  {
    messageId: integer("message_id").notNull(),
    userId: integer("user_id").notNull(),
    emoji: text("emoji").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.messageId, t.userId, t.emoji] }) }),
);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  actorId: integer("actor_id"),
  channelId: integer("channel_id"),
  dmId: integer("dm_id"),
  messageId: integer("message_id"),
  preview: text("preview").notNull().default(""),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(),
});

export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedBy: integer("invited_by").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
