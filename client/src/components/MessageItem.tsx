import { useState } from "react";
import type { Message, PublicUser } from "@slashslack/shared";
import { MessageSquare, SmilePlus, Pencil, Trash2, Check, X, Pin, Bookmark, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { MessageBody } from "./MessageBody";
import { Attachments, LinkPreviews } from "./Attachments";
import { EmojiPicker } from "./EmojiPicker";
import { HoverMenu } from "./HoverMenu";
import { formatTime, messageLink } from "../lib/util";
import { api } from "../lib/api";
import { useBookmarks, useToggleReaction } from "../lib/queries";

export function MessageItem({
  message,
  me,
  users,
  compact,
  highlighted,
  onOpenThread,
}: {
  message: Message;
  me: PublicUser;
  users: PublicUser[];
  compact?: boolean;
  highlighted?: boolean;
  onOpenThread?: (m: Message) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const react = useToggleReaction();
  const qc = useQueryClient();
  const { data: bookmarks } = useBookmarks();
  const mine = message.user.id === me.id;
  const bookmarked = !!bookmarks?.ids.includes(message.id);
  const copyLink = () => navigator.clipboard.writeText(messageLink(message));

  const togglePin = async () => {
    await api.post(`/api/messages/${message.id}/pin`);
  };
  const toggleBookmark = async () => {
    await api.post(`/api/messages/${message.id}/bookmark`);
    qc.invalidateQueries({ queryKey: ["bookmarks"] });
  };

  if (message.deletedAt) {
    return (
      <div className="px-4 py-1 text-sm text-muted italic">This message was deleted</div>
    );
  }

  const saveEdit = async () => {
    if (draft.trim() && draft !== message.body) {
      await api.patch(`/api/messages/${message.id}`, { body: draft });
    }
    setEditing(false);
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative px-4 flex gap-3 ${highlighted ? "highlight-flash" : "hover:bg-sidebar-active/5"}`}
      style={{ paddingTop: compact ? 1 : 8, paddingBottom: 1 }}
    >
      <div className="w-9 shrink-0">
        {!compact ? (
          <Avatar user={message.user} />
        ) : (
          <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 leading-9 block text-center">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {message.pinnedAt && (
          <div className="flex items-center gap-1 text-xs text-accent font-medium">
            <Pin size={11} /> Pinned
          </div>
        )}
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{message.user.displayName}</span>
            <span className="text-xs text-muted">{formatTime(message.createdAt)}</span>
            {message.editedAt && <span className="text-xs text-muted">(edited)</span>}
          </div>
        )}

        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 bg-elev border border-border rounded-theme px-2 py-1"
            />
            <button onClick={saveEdit} className="text-success"><Check size={18} /></button>
            <button onClick={() => setEditing(false)} className="text-muted"><X size={18} /></button>
          </div>
        ) : (
          <MessageBody body={message.body} users={users} />
        )}

        <Attachments items={message.attachments} editable={editing} />
        <LinkPreviews items={message.previews} />

        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r) => {
              const reacted = r.userIds.includes(me.id);
              return (
                <button
                  key={r.emoji}
                  onClick={() => react.mutate({ id: message.id, emoji: r.emoji })}
                  className="flex items-center gap-1 text-sm px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: reacted ? "var(--accent)" : "var(--border)",
                    background: reacted ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
                  }}
                >
                  <span>{r.emoji}</span>
                  <span className="text-xs text-muted">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {!message.parentId && message.replyCount > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message)}
            className="flex items-center gap-1 mt-1 text-sm text-accent font-medium hover:underline"
          >
            <MessageSquare size={14} />
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* hover toolbar — stays visible while a popover within it is open */}
      {!editing && (
        <div
          className={`absolute -top-3 right-3 flex items-center gap-1 bg-elev border border-border rounded-theme shadow px-1 py-0.5 transition-opacity ${
            menuOpen
              ? "opacity-100"
              : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
          }`}
        >
          <HoverMenu
            align="right"
            onOpenChange={setMenuOpen}
            button={({ toggle }) => (
              <button className="p-1 hover:text-accent" onClick={toggle} title="Add reaction">
                <SmilePlus size={16} />
              </button>
            )}
            panel={({ close }) => (
              <EmojiPicker
                onPick={(e) => {
                  react.mutate({ id: message.id, emoji: e });
                  close();
                }}
              />
            )}
          />
          {!message.parentId && onOpenThread && (
            <button className="p-1 hover:text-accent" onClick={() => onOpenThread(message)} title="Reply in thread">
              <MessageSquare size={16} />
            </button>
          )}
          <button className="p-1 hover:text-accent" title="Copy link to message" onClick={copyLink}>
            <Link2 size={16} />
          </button>
          <button
            className="p-1 hover:text-accent"
            title={bookmarked ? "Remove bookmark" : "Save for later"}
            onClick={toggleBookmark}
            style={{ color: bookmarked ? "var(--accent)" : undefined }}
          >
            <Bookmark size={16} fill={bookmarked ? "var(--accent)" : "none"} />
          </button>
          {!message.parentId && (
            <button
              className="p-1 hover:text-accent"
              title={message.pinnedAt ? "Unpin" : "Pin to channel"}
              onClick={togglePin}
              style={{ color: message.pinnedAt ? "var(--accent)" : undefined }}
            >
              <Pin size={16} fill={message.pinnedAt ? "var(--accent)" : "none"} />
            </button>
          )}
          {mine && (
            <button className="p-1 hover:text-accent" title="Edit" onClick={() => { setDraft(message.body); setEditing(true); }}>
              <Pencil size={16} />
            </button>
          )}
          {(mine || me.role === "admin") && (
            <button
              className="p-1 hover:text-danger"
              title="Delete"
              onClick={() => { if (confirm("Delete this message?")) api.del(`/api/messages/${message.id}`); }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
