import { useEffect, useRef, useState, type ReactNode } from "react";

type Pt = { x: number; y: number };
const sign = (p: Pt, a: Pt, b: Pt) => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * A popover that opens on click and closes with tolerance: a grace delay plus a
 * "safe triangle" so moving the cursor toward the panel keeps it open even if it
 * briefly leaves the trigger. No more closing when a single pixel is out.
 */
export function HoverMenu({
  button,
  panel,
  align = "right",
  graceMs = 500,
  onOpenChange,
}: {
  button: (o: { open: boolean; toggle: () => void }) => ReactNode;
  panel: (o: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  graceMs?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const mover = useRef<((e: PointerEvent) => void) | null>(null);

  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const stopTracking = () => {
    if (mover.current) document.removeEventListener("pointermove", mover.current);
    mover.current = null;
  };
  const close = () => {
    clearTimer();
    stopTracking();
    setOpen(false);
  };
  const keepOpen = () => {
    clearTimer();
    stopTracking();
  };

  useEffect(() => () => { clearTimer(); stopTracking(); }, []);

  // close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // tolerant close: grace timer + safe triangle toward the panel
  const beginClose = (from: Pt) => {
    clearTimer();
    timer.current = window.setTimeout(close, graceMs);
    stopTracking();
    const handler = (e: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pt = { x: e.clientX, y: e.clientY };
      if (pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom) {
        keepOpen(); // arrived at the panel
        return;
      }
      const nearTop = Math.abs(from.y - r.top) <= Math.abs(from.y - r.bottom);
      const b = nearTop ? { x: r.left, y: r.top } : { x: r.left, y: r.bottom };
      const c = nearTop ? { x: r.right, y: r.top } : { x: r.right, y: r.bottom };
      if (inTriangle(pt, from, b, c)) {
        clearTimer(); // heading toward the panel — extend the grace window
        timer.current = window.setTimeout(close, graceMs);
      } else {
        close();
      }
    };
    mover.current = handler;
    document.addEventListener("pointermove", handler);
  };

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onPointerEnter={keepOpen}
      onPointerLeave={(e) => open && beginClose({ x: e.clientX, y: e.clientY })}
    >
      {button({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          ref={panelRef}
          className={`absolute z-40 bottom-full mb-1 ${align === "right" ? "right-0" : "left-0"}`}
          onPointerEnter={keepOpen}
          onPointerLeave={(e) => beginClose({ x: e.clientX, y: e.clientY })}
        >
          {/* invisible bridge covering the gap between trigger and panel */}
          <div className="absolute -bottom-2 inset-x-0 h-2" />
          {panel({ close })}
        </div>
      )}
    </span>
  );
}
