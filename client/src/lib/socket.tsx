import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  SocketEvents,
  type AppNotification,
  type AppSettings,
  type LinkPreview,
  type Message,
  type PublicUser,
  type TypingPayload,
} from "@slashslack/shared";
import { api } from "./api";
import { useUi } from "../store";
import { applyFromSettings } from "./theme";

const SocketContext = createContext<Socket | null>(null);
export const useSocket = () => useContext(SocketContext);

export function scopeKey(m: { channelId: number | null; dmId: number | null }) {
  return m.channelId ? `channel:${m.channelId}` : `dm:${m.dmId}`;
}

export function SocketProvider({
  user,
  children,
}: {
  user: PublicUser;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const ui = useUi();
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    {
      // Fetch a fresh handshake token on every (re)connect attempt, so the
      // socket can always reconnect after a server restart or network blip.
      const s = io({
        withCredentials: true,
        auth: (cb) => {
          api
            .get<{ token: string }>("/api/auth/socket")
            .then((r) => cb({ token: r.token }))
            .catch(() => cb({}));
        },
      });
      setSocket(s);

      const upsertInList = (msg: Message) => {
        const key = ["messages", scopeKey(msg)];
        qc.setQueryData<Message[]>(key, (old) => {
          if (!old) return old;
          if (old.some((m) => m.id === msg.id)) {
            return old.map((m) => (m.id === msg.id ? msg : m));
          }
          return [...old, msg];
        });
      };

      s.on(SocketEvents.MessageNew, (msg: Message) => {
        if (msg.parentId) {
          // thread reply: update thread cache + bump parent reply count
          qc.setQueryData<{ parent: Message; replies: Message[] }>(
            ["thread", msg.parentId],
            (old) =>
              old
                ? old.replies.some((r) => r.id === msg.id)
                  ? old
                  : { ...old, replies: [...old.replies, msg] }
                : old,
          );
          const key = ["messages", scopeKey(msg)];
          qc.setQueryData<Message[]>(key, (old) =>
            old?.map((m) =>
              m.id === msg.parentId
                ? { ...m, replyCount: m.replyCount + 1, lastReplyAt: msg.createdAt }
                : m,
            ),
          );
        } else {
          upsertInList(msg);
        }
        // refresh unread badges
        qc.invalidateQueries({ queryKey: ["channels"] });
        qc.invalidateQueries({ queryKey: ["dms"] });
      });

      s.on(SocketEvents.MessageEdit, (msg: Message) => {
        upsertInList(msg);
        if (msg.parentId)
          qc.setQueryData<{ parent: Message; replies: Message[] }>(
            ["thread", msg.parentId],
            (old) =>
              old
                ? { ...old, replies: old.replies.map((r) => (r.id === msg.id ? msg : r)) }
                : old,
          );
        if (msg.channelId)
          qc.setQueryData<Message[]>(["pins", msg.channelId], (old) =>
            old?.map((m) => (m.id === msg.id ? msg : m)),
          );
      });

      s.on(SocketEvents.MessageDelete, (p: { id: number; channelId: number | null; dmId: number | null }) => {
        const key = ["messages", scopeKey(p)];
        qc.setQueryData<Message[]>(key, (old) =>
          old?.map((m) =>
            m.id === p.id ? { ...m, deletedAt: new Date().toISOString(), body: "" } : m,
          ),
        );
        // drop it from the pinned list and any open thread
        if (p.channelId)
          qc.setQueryData<Message[]>(["pins", p.channelId], (old) => old?.filter((m) => m.id !== p.id));
        qc.setQueriesData<{ parent: Message; replies: Message[] }>({ queryKey: ["thread"] }, (old) =>
          old ? { ...old, replies: old.replies.filter((r) => r.id !== p.id) } : old,
        );
      });

      const onReaction = (p: { message: Message }) => {
        upsertInList(p.message);
        if (p.message.parentId)
          qc.setQueryData<{ parent: Message; replies: Message[] }>(
            ["thread", p.message.parentId],
            (old) =>
              old
                ? {
                    ...old,
                    replies: old.replies.map((r) =>
                      r.id === p.message.id ? p.message : r,
                    ),
                  }
                : old,
          );
      };
      s.on(SocketEvents.ReactionAdd, onReaction);
      s.on(SocketEvents.ReactionRemove, onReaction);

      s.on(SocketEvents.PreviewReady, (p: { messageId: number; preview: LinkPreview }) => {
        qc.setQueriesData<Message[]>({ queryKey: ["messages"] }, (old) =>
          old?.map((m) =>
            m.id === p.messageId && !m.previews.some((x) => x.id === p.preview.id)
              ? { ...m, previews: [...m.previews, p.preview] }
              : m,
          ),
        );
      });

      s.on(SocketEvents.MessagePinned, (p: { message: Message; pinned: boolean }) => {
        upsertInList(p.message);
        if (p.message.channelId) {
          // update the pinned list live (add/remove) — no refetch needed
          qc.setQueryData<Message[]>(["pins", p.message.channelId], (old) => {
            const without = (old ?? []).filter((m) => m.id !== p.message.id);
            return p.pinned ? [p.message, ...without] : without;
          });
        }
      });

      s.on(
        SocketEvents.ReceiptUpdate,
        (p: { channelId?: number; dmId?: number; userId: number; lastReadMessageId: number }) => {
          const scope = p.channelId ? `channel:${p.channelId}` : `dm:${p.dmId}`;
          qc.setQueryData<{ userId: number; lastReadMessageId: number }[]>(
            ["receipts", scope],
            (old) => {
              if (!old) return old;
              const others = old.filter((r) => r.userId !== p.userId);
              return [...others, { userId: p.userId, lastReadMessageId: p.lastReadMessageId }];
            },
          );
        },
      );

      s.on(SocketEvents.Typing, (p: TypingPayload) => {
        const key = p.channelId ? `channel:${p.channelId}` : `dm:${p.dmId}`;
        uiRef.current.addTyping(key, p.user);
      });

      s.on(SocketEvents.PresenceUpdate, (u: PublicUser) => {
        uiRef.current.setPresence(u.id, u.status);
      });

      // profile change: refresh the user's name/avatar/status everywhere
      s.on(SocketEvents.UserUpdated, (u: PublicUser) => {
        qc.setQueryData<PublicUser[]>(["users"], (old) =>
          old?.map((x) => (x.id === u.id ? { ...x, ...u } : x)),
        );
        qc.setQueryData<PublicUser>(["me"], (old) => (old?.id === u.id ? { ...old, ...u } : old));
        // patch the embedded author on already-loaded messages + threads
        const patch = (m: Message): Message => (m.user.id === u.id ? { ...m, user: { ...m.user, ...u } } : m);
        qc.setQueriesData<Message[]>({ queryKey: ["messages"] }, (old) => old?.map(patch));
        qc.setQueriesData<Message[]>({ queryKey: ["pins"] }, (old) => old?.map(patch));
        qc.setQueriesData<{ parent: Message; replies: Message[] }>({ queryKey: ["thread"] }, (old) =>
          old ? { parent: patch(old.parent), replies: old.replies.map(patch) } : old,
        );
      });

      s.on(SocketEvents.NotificationNew, (n: AppNotification) => {
        qc.setQueryData<AppNotification[]>(["notifications"], (old) =>
          old ? [n, ...old] : [n],
        );
        qc.invalidateQueries({ queryKey: ["channels"] });
        if (Notification && Notification.permission === "granted") {
          new Notification(n.actor?.displayName || "New message", { body: n.preview });
        }
      });

      const refreshNav = () => {
        qc.invalidateQueries({ queryKey: ["channels"] });
        qc.invalidateQueries({ queryKey: ["categories"] });
      };
      s.on(SocketEvents.ChannelCreated, refreshNav);
      s.on(SocketEvents.ChannelUpdated, refreshNav);
      s.on(SocketEvents.ChannelReordered, refreshNav);
      s.on(SocketEvents.CategoryChanged, refreshNav);

      s.on(SocketEvents.SettingsUpdated, (p: { settings: AppSettings }) => {
        qc.setQueryData(["settings"], p.settings);
        applyFromSettings(p.settings);
      });

      const interval = setInterval(() => uiRef.current.pruneTyping(), 1500);

      return () => {
        clearInterval(interval);
        s.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
