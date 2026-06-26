import { useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageSquare, Mail, CheckCheck } from "lucide-react";
import type { AppNotification } from "@slashslack/shared";
import { Hash } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { formatTime } from "../lib/util";
import { useChannels, useDms, useNotifications } from "../lib/queries";

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
  const { data: channels = [] } = useChannels();
  const { data: dms = [] } = useDms();
  const qc = useQueryClient();
  const unread = notifications.filter((n) => !n.read).length;

  // group notifications by their channel / DM
  type Group = { key: string; label: string; icon: string | null; scope: string | null; items: AppNotification[] };
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const n of notifications) {
    const key = n.channelId ? `channel:${n.channelId}` : n.dmId ? `dm:${n.dmId}` : "other";
    let g = byKey.get(key);
    if (!g) {
      let label = "Other", icon: string | null = null, scope: string | null = null;
      if (n.channelId) {
        const c = channels.find((x) => x.id === n.channelId);
        label = c ? `#${c.name}` : "#channel";
        icon = c?.icon ?? "hash";
        scope = `channel:${n.channelId}`;
      } else if (n.dmId) {
        const d = dms.find((x) => x.id === n.dmId);
        label = d ? d.members.map((m) => m.displayName).join(", ") : "Direct message";
        scope = `dm:${n.dmId}`;
      }
      g = { key, label, icon, scope, items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(n);
  }

  // "Mark all read" clears the list entirely
  const markAll = async () => {
    await api.del("/api/notifications");
    qc.setQueryData<AppNotification[]>(["notifications"], []);
    qc.invalidateQueries({ queryKey: ["channels"] });
  };

  return (
    <Modal title={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`} onClose={onClose} wide>
      <div className="flex justify-end mb-2">
        <button onClick={markAll} className="flex items-center gap-1 text-sm text-accent hover:underline">
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>
      <div className="flex flex-col gap-4 min-h-[40vh]">
        {notifications.length === 0 && (
          <div className="text-muted text-sm py-16 text-center">You're all caught up 🎉</div>
        )}
        {groups.map((g) => {
          const groupUnread = g.items.filter((n) => !n.read).length;
          return (
            <div key={g.key}>
              <div className="flex items-center gap-1.5 px-1 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {g.icon ? <Icon name={g.icon} size={13} /> : <Hash size={13} />}
                <span>{g.label}</span>
                {groupUnread > 0 && (
                  <span className="bg-accent text-accent-fg text-[10px] rounded-full px-1.5">{groupUnread}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {g.items.map((n) => {
                  const I = ICONS[n.type] || Mail;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (g.scope) onJump(g.scope);
                        onClose();
                      }}
                      className="flex items-start gap-3 p-3 rounded-theme hover:bg-sidebar-active/10 text-left w-full"
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
          );
        })}
      </div>
    </Modal>
  );
}
