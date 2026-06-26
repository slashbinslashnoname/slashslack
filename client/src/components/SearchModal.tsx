import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@slashslack/shared";
import { Lock } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { formatTime } from "../lib/util";
import { useChannels } from "../lib/queries";

export function SearchModal({
  onClose,
  onJump,
}: {
  onClose: () => void;
  onJump: (scope: string) => void;
}) {
  const [q, setQ] = useState("");
  const { data: channels = [] } = useChannels();
  const { data: results = [] } = useQuery({
    queryKey: ["search", q],
    enabled: q.trim().length > 1,
    queryFn: () =>
      api.get<{ results: Message[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.results),
  });

  const channelMatches =
    q.trim().length > 0
      ? channels.filter(
          (c) =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.topic.toLowerCase().includes(q.toLowerCase()),
        )
      : [];

  return (
    <Modal title="Search" onClose={onClose} wide>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search channels and messages…"
        className="w-full border border-border rounded-theme px-3 py-2 mb-4 bg-elev"
      />
      <div className="flex flex-col gap-2">
        {channelMatches.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-wide text-muted">Channels</div>
            {channelMatches.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onJump(`channel:${c.id}`);
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-theme hover:bg-sidebar-active/10 text-left"
              >
                {c.isPrivate ? <Lock size={16} /> : <Icon name={c.icon} size={16} />}
                <span className="font-medium">{c.name}</span>
                {c.topic && <span className="text-xs text-muted truncate">— {c.topic}</span>}
              </button>
            ))}
            <div className="text-xs uppercase tracking-wide text-muted mt-2">Messages</div>
          </>
        )}
        {q.trim().length > 1 && results.length === 0 && (
          <div className="text-muted text-sm">No message matches.</div>
        )}
        {results.map((m) => (
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
              <div className="text-sm text-muted truncate">{m.body}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
