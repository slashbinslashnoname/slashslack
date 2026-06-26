import type { Message } from "@slashslack/shared";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { formatTime } from "../lib/util";

export function MessageListModal({
  title,
  messages,
  emptyText,
  onClose,
  onJump,
}: {
  title: string;
  messages: Message[];
  emptyText: string;
  onClose: () => void;
  onJump: (scope: string) => void;
}) {
  return (
    <Modal title={title} onClose={onClose} wide>
      {messages.length === 0 && <div className="text-muted text-sm py-6 text-center">{emptyText}</div>}
      <div className="flex flex-col gap-2">
        {messages.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              onJump(m.channelId ? `channel:${m.channelId}` : `dm:${m.dmId}`);
              onClose();
            }}
            className="flex gap-3 text-left p-2 rounded-theme hover:bg-sidebar-active/10"
          >
            <Avatar user={m.user} size={32} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold">{m.user.displayName}</span>
                <span className="text-xs text-muted">{formatTime(m.createdAt)}</span>
              </div>
              <div className="text-sm text-muted truncate">{m.body || "(attachment)"}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
