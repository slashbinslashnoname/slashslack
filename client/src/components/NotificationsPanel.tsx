import { useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageSquare, Mail } from "lucide-react";
import type { AppNotification } from "@slashslack/shared";
import { api } from "../lib/api";
import { Modal } from "./Modal";
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

  const markAll = async () => {
    await api.post("/api/notifications/read", {});
    qc.setQueryData<AppNotification[]>(["notifications"], (old) =>
      old?.map((n) => ({ ...n, read: true })),
    );
    qc.invalidateQueries({ queryKey: ["channels"] });
  };

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="flex justify-end mb-2">
        <button onClick={markAll} className="text-sm text-accent hover:underline">
          Mark all read
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {notifications.length === 0 && (
          <div className="text-muted text-sm py-6 text-center">You're all caught up 🎉</div>
        )}
        {notifications.map((n) => {
          const I = ICONS[n.type] || Mail;
          return (
            <button
              key={n.id}
              onClick={() => {
                onJump(n.channelId ? `channel:${n.channelId}` : `dm:${n.dmId}`);
                onClose();
              }}
              className="flex items-start gap-3 p-2 rounded-theme hover:bg-sidebar-active/10 text-left"
              style={{ background: n.read ? undefined : "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            >
              {n.actor ? <Avatar user={n.actor} size={32} /> : <I size={20} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm">
                  <I size={13} className="text-muted" />
                  <span className="font-medium">{n.actor?.displayName || "Someone"}</span>
                  <span className="text-muted">·</span>
                  <span className="text-xs text-muted">{formatTime(n.createdAt)}</span>
                </div>
                <div className="text-sm text-muted truncate">{n.preview}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
