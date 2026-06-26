import { useRef, useState } from "react";
import type { Attachment, PublicUser } from "@slashslack/shared";
import { Paperclip, Send, SmilePlus, X } from "lucide-react";
import { api } from "../lib/api";
import { useSendMessage, useUsers } from "../lib/queries";
import { useSocket } from "../lib/socket";
import { SocketEvents } from "@slashslack/shared";
import { EmojiPicker } from "./EmojiPicker";
import { humanSize } from "../lib/util";

interface Props {
  channelId?: number;
  dmId?: number;
  parentId?: number;
  placeholder: string;
}

export function Composer({ channelId, dmId, parentId, placeholder }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [mentions, setMentions] = useState<{ name: string; id: number }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  const { data: users = [] } = useUsers();
  const send = useSendMessage();
  const socket = useSocket();

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current > 2000 && socket) {
      socket.emit(SocketEvents.TypingStart, { channelId, dmId });
      lastTyping.current = now;
    }
  };

  const onChange = (v: string) => {
    setText(v);
    emitTyping();
    const m = /(^|\s)@(\w*)$/.exec(v.slice(0, taRef.current?.selectionStart ?? v.length));
    setMentionQuery(m ? m[2] : null);
  };

  const pickMention = (u: PublicUser) => {
    setText((t) => t.replace(/(^|\s)@(\w*)$/, `$1@${u.displayName} `));
    setMentions((list) =>
      list.some((x) => x.id === u.id) ? list : [...list, { name: u.displayName, id: u.id }],
    );
    setMentionQuery(null);
    taRef.current?.focus();
  };

  // @channel / @everyone are sent literally and parsed server-side
  const pickBroadcast = (token: string) => {
    setText((t) => t.replace(/(^|\s)@(\w*)$/, `$1@${token} `));
    setMentionQuery(null);
    taRef.current?.focus();
  };
  const broadcastMatches =
    mentionQuery !== null
      ? ["channel", "everyone", "here"].filter((b) => b.startsWith(mentionQuery.toLowerCase()))
      : [];

  const uploadFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      try {
        const { attachment } = await api.upload<{ attachment: Attachment }>("/api/uploads", f);
        setPending((p) => [...p, attachment]);
      } catch {
        /* ignore */
      }
    }
  };

  const runSlashCommand = async (raw: string): Promise<string | null> => {
    // returns the body to send, or null to abort sending
    const [cmd, ...rest] = raw.slice(1).split(" ");
    const arg = rest.join(" ").trim();
    switch (cmd.toLowerCase()) {
      case "shrug":
        return `${arg} ¯\\_(ツ)_/¯`.trim();
      case "me":
        return arg ? `_${arg}_` : null;
      case "gif":
        // keyless: paste a GIF/image URL and it renders inline
        return /^https?:\/\/\S+/.test(arg) ? arg : null;
      default:
        return raw; // unknown command: send literally
    }
  };

  const submit = async () => {
    let body = text.trim();
    // slash commands
    if (body.startsWith("/")) {
      const result = await runSlashCommand(body);
      if (result === null) {
        setText("");
        return;
      }
      body = result;
    }
    // convert @DisplayName back into <@id> tokens (longest names first)
    for (const m of [...mentions].sort((a, b) => b.name.length - a.name.length)) {
      body = body.split(`@${m.name}`).join(`<@${m.id}>`);
    }
    if (!body && pending.length === 0) return;
    await send.mutateAsync({
      channelId: channelId ?? null,
      dmId: dmId ?? null,
      parentId: parentId ?? null,
      body,
      attachmentIds: pending.map((a) => a.id),
    });
    setText("");
    setPending([]);
    setMentions([]);
  };

  const filteredUsers =
    mentionQuery !== null
      ? users.filter((u) => u.displayName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

  return (
    <div className="px-4 pb-4">
      <div
        className="relative border border-border rounded-theme bg-bg focus-within:border-accent"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
      >
        {mentionQuery !== null && (filteredUsers.length > 0 || broadcastMatches.length > 0) && (
          <div className="absolute bottom-full mb-1 left-2 bg-elev border border-border rounded-theme shadow-lg w-64 overflow-hidden z-30">
            {broadcastMatches.map((b) => (
              <button
                key={b}
                onClick={() => pickBroadcast(b)}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-sidebar-active/15 text-left"
              >
                <span className="font-medium text-accent">@{b}</span>
                <span className="text-xs text-muted">Notify the whole channel</span>
              </button>
            ))}
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => pickMention(u)}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-sidebar-active/15 text-left"
              >
                <span className="font-medium">{u.displayName}</span>
              </button>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-border">
            {pending.map((a) => (
              <div key={a.id} className="relative">
                {a.mime.startsWith("image/") ? (
                  <img src={a.thumbUrl || a.url} className="h-16 w-16 object-cover rounded" />
                ) : (
                  <div className="h-16 w-28 rounded bg-elev border border-border flex items-center justify-center text-xs px-1 text-center">
                    {a.filename}
                    <span className="block text-muted">{humanSize(a.size)}</span>
                  </div>
                )}
                <button
                  className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-0.5"
                  onClick={() => setPending((p) => p.filter((x) => x.id !== a.id))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) uploadFiles(files);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-3 py-2.5 outline-none max-h-40"
        />

        <div className="flex items-center justify-between px-2 pb-1.5">
          <div className="flex items-center gap-1 relative">
            <button className="p-1.5 text-muted hover:text-accent" onClick={() => fileInput.current?.click()}>
              <Paperclip size={18} />
            </button>
            <button className="p-1.5 text-muted hover:text-accent" onClick={() => setShowEmoji((v) => !v)}>
              <SmilePlus size={18} />
            </button>
            {showEmoji && (
              <EmojiPicker
                onPick={(e) => setText((t) => t + e)}
                onClose={() => setShowEmoji(false)}
              />
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
          <button
            onClick={submit}
            disabled={send.isPending}
            className="flex items-center gap-1 bg-accent text-accent-fg px-3 py-1.5 rounded-theme disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
