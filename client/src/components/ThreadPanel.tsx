import type { Message, PublicUser } from "@slashslack/shared";
import { X } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { useThread, useUsers } from "../lib/queries";

export function ThreadPanel({
  parent,
  me,
  onClose,
}: {
  parent: Message;
  me: PublicUser;
  onClose: () => void;
}) {
  const { data } = useThread(parent.id);
  const { data: users = [] } = useUsers();
  const replies = data?.replies ?? [];
  const head = data?.parent ?? parent;

  return (
    <div className="w-full md:w-[380px] h-full border-l border-border flex flex-col bg-bg">
      <div className="h-14 border-b border-border flex items-center justify-between px-4">
        <div className="font-semibold">Thread</div>
        <button onClick={onClose} className="text-muted hover:text-fg">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin py-3">
        <MessageItem message={head} me={me} users={users} />
        <div className="flex items-center gap-3 px-4 my-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        {replies.map((r) => (
          <MessageItem key={r.id} message={r} me={me} users={users} />
        ))}
      </div>
      <Composer
        channelId={head.channelId ?? undefined}
        dmId={head.dmId ?? undefined}
        parentId={head.id}
        placeholder="Reply…"
      />
    </div>
  );
}
