import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message, PublicUser } from "@slashslack/shared";
import { MessageItem } from "./MessageItem";
import { Avatar } from "./Avatar";
import { useChannels, useDms, useMessages, useReceipts, useUsers } from "../lib/queries";
import { api } from "../lib/api";
import { formatDay } from "../lib/util";

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function MessageList({
  scope,
  me,
  focusMessageId,
  onOpenThread,
}: {
  scope: string;
  me: PublicUser;
  focusMessageId?: number | null;
  onOpenThread: (m: Message) => void;
}) {
  const { data: messages = [], isLoading } = useMessages(scope);
  const { data: users = [] } = useUsers();
  const { data: receipts = [] } = useReceipts(scope);
  const { data: channels = [] } = useChannels();
  const { data: dms = [] } = useDms();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Freeze the "last read" boundary on entering a scope so the unread divider
  // stays put even after the channel is marked read (clears on next visit).
  const boundaryRef = useRef<Record<string, number>>({});
  const [kind, idStr] = scope.split(":");
  const id = Number(idStr);
  const liveLastRead =
    kind === "channel"
      ? channels.find((c) => c.id === id)?.lastRead
      : dms.find((d) => d.id === id)?.lastRead;
  if (boundaryRef.current[scope] === undefined && liveLastRead !== undefined) {
    boundaryRef.current[scope] = liveLastRead;
  }
  const boundary = boundaryRef.current[scope] ?? 0;
  const firstUnread = messages.find((m) => m.id > boundary && m.user.id !== me.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const focusedRef = useRef<number | null>(null);

  // jump to bottom on new messages / scope change, unless focusing a permalink
  useEffect(() => {
    if (!loadingOlder && !focusMessageId) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length, scope, focusMessageId]);

  // permalink focus: ensure the target is loaded, scroll to it, and flash it
  useEffect(() => {
    if (!focusMessageId || focusedRef.current === focusMessageId) return;
    const flash = () => {
      requestAnimationFrame(() => {
        document.getElementById(`msg-${focusMessageId}`)?.scrollIntoView({ block: "center" });
        setHighlightId(focusMessageId);
        window.setTimeout(() => setHighlightId(null), 2500);
      });
    };
    if (messages.some((m) => m.id === focusMessageId)) {
      focusedRef.current = focusMessageId;
      flash();
    } else if (messages.length) {
      focusedRef.current = focusMessageId;
      const [kind, id] = scope.split(":");
      const url =
        kind === "channel"
          ? `/api/channels/${id}/messages?around=${focusMessageId}`
          : `/api/dms/${id}/messages?around=${focusMessageId}`;
      api.get<{ messages: Message[] }>(url).then((res) => {
        qc.setQueryData(["messages", scope], res.messages);
        window.setTimeout(flash, 60);
      });
    }
  }, [focusMessageId, messages, scope, qc]);

  useEffect(() => setHasMore(true), [scope]);

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const [kind, id] = scope.split(":");
    const url =
      kind === "channel"
        ? `/api/channels/${id}/messages?before=${messages[0].id}`
        : `/api/dms/${id}/messages?before=${messages[0].id}`;
    const res = await api.get<{ messages: Message[]; hasMore: boolean }>(url);
    qc.setQueryData<Message[]>(["messages", scope], (old) => [...res.messages, ...(old ?? [])]);
    setHasMore(res.hasMore);
    // preserve scroll position after prepend
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
      setLoadingOlder(false);
    });
  };

  // who has read the last message (excluding me)
  const lastMessage = messages[messages.length - 1];
  const seenBy =
    lastMessage && lastMessage.user.id === me.id
      ? receipts
          .filter((r) => r.userId !== me.id && r.lastReadMessageId >= lastMessage.id)
          .map((r) => users.find((u) => u.id === r.userId))
          .filter(Boolean)
      : [];

  if (isLoading)
    return <div className="flex-1 flex items-center justify-center text-muted">Loading…</div>;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin py-3">
      {messages.length > 0 && hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={loadOlder}
            disabled={loadingOlder}
            className="text-sm text-accent hover:underline disabled:opacity-50"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}
      {messages.length === 0 && (
        <div className="text-center text-muted py-10">
          This is the very beginning. Say something!
        </div>
      )}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
        const grouped =
          !showDay &&
          prev &&
          prev.user.id === m.user.id &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
        return (
          <div key={m.id}>
            {firstUnread?.id === m.id && (
              <div className="flex items-center gap-2 px-4 my-2">
                <div className="flex-1 h-px bg-danger" />
                <span className="text-xs font-semibold text-danger">New messages</span>
              </div>
            )}
            {showDay && (
              <div className="flex items-center gap-3 px-4 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-semibold text-muted">{formatDay(m.createdAt)}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <MessageItem
              message={m}
              me={me}
              users={users}
              compact={!!grouped}
              highlighted={highlightId === m.id}
              onOpenThread={onOpenThread}
            />
          </div>
        );
      })}
      {seenBy.length > 0 && (
        <div className="flex items-center justify-end gap-1 px-4 py-1">
          <span className="text-xs text-muted">Seen by</span>
          {seenBy.slice(0, 5).map((u) => (
            <Avatar key={u!.id} user={u!} size={16} />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
