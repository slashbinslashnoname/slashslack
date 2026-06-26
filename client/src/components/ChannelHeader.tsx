import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { Channel } from "@slashslack/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "./Icon";
import { api } from "../lib/api";

/** Click-to-edit text. Saves on Enter/blur, cancels on Escape. */
function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onSave(v);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className={className} title="Click to edit">
      {value || <span className="text-muted italic">{placeholder}</span>}
    </button>
  );
}

export function ChannelHeader({ channel }: { channel: Channel }) {
  const qc = useQueryClient();
  const patch = (body: Partial<Channel>) =>
    api.patch(`/api/channels/${channel.id}`, body).then(() => qc.invalidateQueries({ queryKey: ["channels"] }));

  return (
    <div className="flex items-center gap-2 min-w-0">
      {channel.isPrivate ? <Lock size={18} /> : <Icon name={channel.icon} size={18} />}
      <EditableText
        value={channel.name}
        onSave={(v) => v && patch({ name: v })}
        className="font-bold truncate hover:bg-sidebar-active/10 rounded px-1 -mx-1"
        inputClassName="font-bold bg-elev border border-border rounded px-1 outline-none focus:border-accent"
      />
      <span className="text-border hidden sm:inline">|</span>
      <EditableText
        value={channel.topic}
        onSave={(v) => patch({ topic: v })}
        placeholder="Add a topic"
        className="text-muted text-sm truncate hidden sm:inline hover:bg-sidebar-active/10 rounded px-1"
        inputClassName="text-sm bg-elev border border-border rounded px-1 outline-none focus:border-accent hidden sm:inline w-64"
      />
    </div>
  );
}
