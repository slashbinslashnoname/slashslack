import { useState } from "react";
import type { Attachment, LinkPreview } from "@slashslack/shared";
import { FileText, Download, Check, Pencil } from "lucide-react";
import { humanSize } from "../lib/util";
import { api } from "../lib/api";
import { VideoPlayer } from "./VideoPlayer";

function RenameField({ att }: { att: Attachment }) {
  const [name, setName] = useState(att.filename);
  const save = () => {
    if (name.trim() && name !== att.filename) api.patch(`/api/attachments/${att.id}`, { filename: name.trim() });
  };
  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="text-xs bg-elev border border-border rounded px-1 py-0.5 w-44"
      />
      <button onClick={save} className="text-success" title="Rename">
        <Check size={14} />
      </button>
    </div>
  );
}

export function Attachments({ items, editable }: { items: Attachment[]; editable?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2 mt-1">
      {items.map((a) => {
        const isImage = a.mime.startsWith("image/");
        const isVideo = a.mime.startsWith("video/");
        return (
          <div key={a.id}>
            {isImage ? (
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.thumbUrl || a.url} alt={a.filename} className="rounded-theme max-h-64 border border-border" />
              </a>
            ) : isVideo ? (
              <VideoPlayer src={a.url} />
            ) : (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-border rounded-theme px-3 py-2 bg-elev hover:bg-sidebar-active/10"
              >
                <FileText size={20} className="text-muted" />
                <span className="text-sm">
                  <span className="block max-w-[200px] truncate">{a.filename}</span>
                  <span className="text-xs text-muted">{humanSize(a.size)}</span>
                </span>
                <Download size={16} className="text-muted" />
              </a>
            )}
            {editable ? (
              <RenameField att={a} />
            ) : (
              (isImage || isVideo) && <div className="text-xs text-muted mt-0.5 max-w-[200px] truncate">{a.filename}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LinkPreviews({ items }: { items: LinkPreview[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2 mt-1">
      {items.map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="flex gap-3 border-l-4 border-accent bg-elev rounded-r-theme p-2 max-w-lg hover:bg-sidebar-active/10"
        >
          {p.image && <img src={p.image} alt="" className="w-16 h-16 object-cover rounded" />}
          <div className="min-w-0">
            {p.siteName && <div className="text-xs text-muted">{p.siteName}</div>}
            <div className="font-semibold text-sm truncate">{p.title || p.url}</div>
            {p.description && <div className="text-xs text-muted line-clamp-2">{p.description}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}
