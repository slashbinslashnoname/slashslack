import { useEffect, useRef, useState } from "react";
import type { Message, PublicUser } from "@slashslack/shared";
import { X } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { useThread, useUsers } from "../lib/queries";

const WIDTH_KEY = "slashslack:thread-width";
const MIN_W = 320;
const MAX_W = 760;

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

  const [width, setWidth] = useState(
    () => Number(localStorage.getItem(WIDTH_KEY)) || 380,
  );
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  const dragging = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const h = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
      setWidth(w);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      localStorage.setItem(WIDTH_KEY, String(width));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  return (
    <div
      className="relative w-full md:w-auto h-full border-l border-border flex flex-col bg-bg"
      style={{ width: isDesktop ? width : undefined }}
    >
      {/* resize handle (desktop only) */}
      <div
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.userSelect = "none";
        }}
        className="hidden md:block absolute left-0 top-0 h-full w-1 -ml-0.5 cursor-col-resize hover:bg-accent/40 z-10"
        title="Drag to resize"
      />
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
