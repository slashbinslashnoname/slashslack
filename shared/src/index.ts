import { z } from "zod";

/* ----------------------------- Auth ----------------------------- */

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(60),
  inviteToken: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const createInviteSchema = z.object({
  // omit email to generate a generic link where the user picks their own email
  email: z.string().email().optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export interface Invite {
  id: number;
  email: string;
  token: string;
  acceptedAt: string | null;
  createdAt: string;
  inviteUrl: string;
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = "admin" | "member";
export type PresenceStatus = "online" | "away" | "offline";

export interface PublicUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: PresenceStatus;
  statusText: string | null;
}

/* --------------------------- Channels ---------------------------- */

export const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().min(1).max(40).default("folder"),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .transform((s) => s.trim().toLowerCase().replace(/\s+/g, "-")),
  topic: z.string().max(280).optional().default(""),
  isPrivate: z.boolean().optional().default(false),
  categoryId: z.number().int().nullable().optional(),
  icon: z.string().min(1).max(40).optional().default("hash"),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  topic: z.string().max(280).optional(),
  icon: z.string().min(1).max(40).optional(),
  categoryId: z.number().int().nullable().optional(),
  isPromoted: z.boolean().optional(),
});
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

export const reorderSchema = z.object({
  // ordered list of ids for either channels or categories
  ids: z.array(z.number().int()),
  // optional category context when reordering channels within a category
  categoryId: z.number().int().nullable().optional(),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export interface Category {
  id: number;
  name: string;
  icon: string;
  position: number;
}

export interface Channel {
  id: number;
  name: string;
  topic: string;
  icon: string;
  isPrivate: boolean;
  isPromoted: boolean;
  categoryId: number | null;
  position: number;
  createdBy: number;
  unread?: number;
  hasMention?: boolean;
  lastRead?: number;
}

/* --------------------------- Messages ---------------------------- */

export const createMessageSchema = z.object({
  channelId: z.number().int().nullable().optional(),
  dmId: z.number().int().nullable().optional(),
  parentId: z.number().int().nullable().optional(),
  body: z.string().max(8000).default(""),
  attachmentIds: z.array(z.number().int()).optional().default([]),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const editMessageSchema = z.object({
  body: z.string().min(1).max(8000),
});

export interface Attachment {
  id: number;
  messageId: number | null;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  thumbUrl: string | null;
}

export interface LinkPreview {
  id: number;
  messageId: number;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: number[];
}

export interface Message {
  id: number;
  channelId: number | null;
  dmId: number | null;
  parentId: number | null;
  user: PublicUser;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
  attachments: Attachment[];
  previews: LinkPreview[];
  reactions: Reaction[];
  replyCount: number;
  lastReplyAt: string | null;
}

/* ------------------------------ DMs ------------------------------ */

export const createDmSchema = z.object({
  userIds: z.array(z.number().int()).min(1),
});
export type CreateDmInput = z.infer<typeof createDmSchema>;

export interface DmConversation {
  id: number;
  members: PublicUser[];
  unread?: number;
  lastRead?: number;
}

/* -------------------------- Reactions ---------------------------- */

export const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(40),
});

/* ------------------------- Notifications ------------------------- */

export type NotificationType =
  | "mention"
  | "dm"
  | "thread_reply"
  | "channel_invite";

export interface AppNotification {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: PublicUser | null;
  channelId: number | null;
  dmId: number | null;
  messageId: number | null;
  preview: string;
}

/* --------------------------- Settings ---------------------------- */

export interface ThemeTokens {
  [cssVar: string]: string;
}

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
  theme: ThemeTokens;
  defaultTheme: "light" | "dark";
  allowRegistration: boolean;
  maxUploadMb: number;
  presets: Record<string, ThemeTokens>;
}

export const updateSettingsSchema = z.object({
  appName: z.string().min(1).max(60).optional(),
  logoUrl: z.string().nullable().optional(),
  theme: z.record(z.string()).optional(),
  defaultTheme: z.enum(["light", "dark"]).optional(),
  allowRegistration: z.boolean().optional(),
  maxUploadMb: z.number().int().min(1).max(500).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/* ----------------------- Socket event names ---------------------- */

export const SocketEvents = {
  MessageNew: "message:new",
  MessageEdit: "message:edit",
  MessageDelete: "message:delete",
  ReactionAdd: "reaction:add",
  ReactionRemove: "reaction:remove",
  Typing: "typing",
  PresenceUpdate: "presence:update",
  ChannelCreated: "channel:created",
  ChannelUpdated: "channel:updated",
  ChannelReordered: "channel:reordered",
  CategoryChanged: "category:changed",
  NotificationNew: "notification:new",
  PreviewReady: "preview:ready",
  SettingsUpdated: "settings:updated",
  MessagePinned: "message:pinned",
  ReceiptUpdate: "receipt:update",
  UserUpdated: "user:updated",
  // client -> server
  Subscribe: "subscribe",
  TypingStart: "typing:start",
  ReadChannel: "read",
  PresenceSet: "presence:set",
} as const;

export interface ReadReceipt {
  userId: number;
  lastReadMessageId: number;
}

export interface TypingPayload {
  channelId: number | null;
  dmId: number | null;
  user: PublicUser;
}
