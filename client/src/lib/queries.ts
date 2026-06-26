import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AppNotification,
  AppSettings,
  Category,
  Channel,
  CreateMessageInput,
  DmConversation,
  Message,
  PublicUser,
} from "@slashslack/shared";
import { api } from "./api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: PublicUser }>("/api/auth/me").then((r) => r.user),
    retry: false,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: AppSettings }>("/api/settings").then((r) => r.settings),
  });
}

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: () => api.get<{ channels: Channel[] }>("/api/channels").then((r) => r.channels),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/api/categories").then((r) => r.categories),
  });
}

export function useDms() {
  return useQuery({
    queryKey: ["dms"],
    queryFn: () => api.get<{ dms: DmConversation[] }>("/api/dms").then((r) => r.dms),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: PublicUser[] }>("/api/users").then((r) => r.users),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api.get<{ notifications: AppNotification[] }>("/api/notifications").then((r) => r.notifications),
  });
}

/** scope is "channel:ID" or "dm:ID" */
export function useMessages(scope: string | null) {
  return useQuery({
    queryKey: ["messages", scope],
    enabled: !!scope,
    queryFn: () => {
      const [kind, id] = scope!.split(":");
      const url = kind === "channel" ? `/api/channels/${id}/messages` : `/api/dms/${id}/messages`;
      return api.get<{ messages: Message[] }>(url).then((r) => r.messages);
    },
  });
}

export function usePins(channelId: number | null) {
  return useQuery({
    queryKey: ["pins", channelId],
    enabled: !!channelId,
    queryFn: () =>
      api.get<{ messages: Message[] }>(`/api/channels/${channelId}/pins`).then((r) => r.messages),
  });
}

export function useBookmarks() {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: () =>
      api.get<{ ids: number[]; messages: Message[] }>("/api/bookmarks"),
  });
}

export function useReceipts(scope: string | null) {
  return useQuery({
    queryKey: ["receipts", scope],
    enabled: !!scope,
    refetchInterval: false,
    queryFn: () => {
      const [kind, id] = scope!.split(":");
      const url = kind === "channel" ? `/api/channels/${id}/receipts` : `/api/dms/${id}/receipts`;
      return api.get<{ receipts: { userId: number; lastReadMessageId: number }[] }>(url).then((r) => r.receipts);
    },
  });
}

export function useThread(parentId: number | null) {
  return useQuery({
    queryKey: ["thread", parentId],
    enabled: !!parentId,
    queryFn: () =>
      api.get<{ parent: Message; replies: Message[] }>(`/api/messages/${parentId}/thread`),
  });
}

function messageScope(m: { channelId: number | null; dmId: number | null }) {
  return m.channelId ? `channel:${m.channelId}` : `dm:${m.dmId}`;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMessageInput) =>
      api.post<{ message: Message }>("/api/messages", input).then((r) => r.message),
    // Write the message into the cache immediately so it shows even if the
    // websocket echo is delayed/disconnected. Idempotent with the socket handler.
    onSuccess: (msg) => {
      if (msg.parentId) {
        qc.setQueryData<{ parent: Message; replies: Message[] }>(["thread", msg.parentId], (old) =>
          old && !old.replies.some((r) => r.id === msg.id)
            ? { ...old, replies: [...old.replies, msg] }
            : old,
        );
        qc.setQueryData<Message[]>(["messages", messageScope(msg)], (old) =>
          old?.map((m) =>
            m.id === msg.parentId
              ? { ...m, replyCount: m.replyCount + 1, lastReplyAt: msg.createdAt }
              : m,
          ),
        );
      } else {
        qc.setQueryData<Message[]>(["messages", messageScope(msg)], (old) => {
          if (!old) return old;
          if (old.some((m) => m.id === msg.id)) return old.map((m) => (m.id === msg.id ? msg : m));
          return [...old, msg];
        });
      }
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api.post<{ message: Message }>(`/api/messages/${id}/react`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
