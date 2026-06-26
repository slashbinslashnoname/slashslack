import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { PublicUser } from "@slashslack/shared";
import { VideoPlayer } from "./VideoPlayer";

const IMG_RE = /\.(gif|png|jpe?g|webp|avif)(\?\S*)?$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|ogg)(\?\S*)?$/i;

marked.setOptions({ gfm: true, breaks: true });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Render full markdown instantly. Mentions (<@id>) and @channel/@everyone are
 * protected with placeholders before markdown parsing, then re-injected as chips.
 */
export function MessageBody({ body, users }: { body: string; users: PublicUser[] }) {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const html = useMemo(() => {
    const mentions: string[] = [];
    let src = body.replace(/<@(\d+)>/g, (_m, id) => {
      const u = userMap.get(Number(id));
      mentions.push(escapeHtml(u?.displayName || "user"));
      return `%%MENTION${mentions.length - 1}%%`;
    });
    src = src.replace(/(^|\s)@(channel|everyone|here)\b/gi, (_m, pre, w) => `${pre}%%BCAST_${w}%%`);

    let out = marked.parse(src, { async: false }) as string;
    out = DOMPurify.sanitize(out, { ADD_ATTR: ["target", "rel"] });
    // open links in a new tab
    out = out.replace(/<a /g, '<a target="_blank" rel="noreferrer" ');
    // re-inject mention chips (content is already escaped)
    out = out.replace(/%%MENTION(\d+)%%/g, (_m, i) => `<span class="mention-chip">@${mentions[Number(i)]}</span>`);
    out = out.replace(/%%BCAST_(channel|everyone|here)%%/gi, (_m, w) => `<span class="mention-chip">@${w}</span>`);
    return out;
  }, [body, userMap]);

  // bare media URLs render inline below the text
  const media = useMemo(() => {
    const urls = body.match(/\bhttps?:\/\/[^\s<>]+/gi) || [];
    return [...new Set(urls)]
      .map((u) => ({ url: u, kind: IMG_RE.test(u) ? "img" : VID_RE.test(u) ? "vid" : null }))
      .filter((m) => m.kind);
  }, [body]);

  return (
    <div className="msg-body break-words">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {media.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {media.map((m, i) =>
            m.kind === "img" ? (
              <a key={i} href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} className="rounded-theme max-h-64 border border-border" />
              </a>
            ) : (
              <VideoPlayer key={i} src={m.url} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
