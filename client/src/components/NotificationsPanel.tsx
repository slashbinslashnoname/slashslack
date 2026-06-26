import { useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageSquare, Mail, X, CheckCheck } from "lucide-react";
import type { AppNotification } from "@slashslack/shared";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";
import { formatTime } from "../lib/util";
import { useNotifications } from "../lib/queries";

const ICONS = {
  mention: AtSign,
  thread_reply: MessageSquare,
  dm: Mail,
  channel_invite: Mail,
};

export function NotificationsPanel({
  onClose,
  onJump,
}: {
  onClose: () => void;
  onJump: (scope: string) => void;
}) {
  const { data: notifications = [] } = useNotifications();
  const qc = useQueryClient();
  const unread = notifications.filter((n) => !n.read).length;

  const markAll = async () => {
    await api.post("/api/notifications/read", {});
    qc.setQueryData<AppNotification[]>(["notifications"], (old) => old?.map((n) => ({ ...n, read: true })));
    qc.invalidateQueries({ queryKey: ["channels"] });
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <h2 className="font-bold text-lg flex-1">
          Notifications {unread > 0 && <span className="text-muted font-normal text-sm">({unread} unread)</span>}
        </h2>
        <button onClick={markAll} className="flex items-center gap-1 text-sm text-accent hover:underline">
          <CheckCheck size={16} /> Mark all read
        </button>
        <button onClick={onClose} className="text-muted hover:text-fg">
          <X size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scroll-thin">
        <div className="max-w-2xl mx-auto w-full p-3">
          {notifications.length === 0 && (
            <div className="text-muted text-sm py-20 text-center">You're all caught up 🎉</div>
          )}
          <div className="flex flex-col gap-1">
            {notifications.map((n) => {
              const I = ICONS[n.type] || Mail;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onJump(n.channelId ? `channel:${n.channelId}` : `dm:${n.dmId}`);
                    onClose();
                  }}
                  className="flex items-start gap-3 p-3 rounded-theme hover:bg-sidebar-active/10 text-left"
                  style={{ background: n.read ? undefined : "color-mix(in srgb, var(--accent) 8%, transparent)" }}
                >
                  {n.actor ? <Avatar user={n.actor} size={36} /> : <I size={22} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <I size={14} className="text-muted" />
                      <span className="font-medium">{n.actor?.displayName || "Someone"}</span>
                      <span className="text-muted">·</span>
                      <span className="text-xs text-muted">{formatTime(n.createdAt)}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-accent ml-1" />}
                    </div>
                    <div className="text-sm text-muted truncate">{n.preview}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
