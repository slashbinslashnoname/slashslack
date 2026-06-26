export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

// deterministic color from a string (for avatar backgrounds)
export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export function formatTime(iso: string) {
  const d = new Date(iso.includes("Z") || iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

/** Router path for a scope ("channel:ID" | "dm:ID"). */
export function scopePath(scope: string) {
  const [kind, id] = scope.split(":");
  return kind === "channel" ? `/c/${id}` : `/dm/${id}`;
}

/** Router path for a specific message (permalink). */
export function messagePath(m: { channelId: number | null; dmId: number | null; id: number }) {
  return m.channelId ? `/c/${m.channelId}/${m.id}` : `/dm/${m.dmId}/${m.id}`;
}

/** Absolute permalink URL to a message. */
export function messageLink(m: { channelId: number | null; dmId: number | null; id: number }) {
  return `${location.origin}${messagePath(m)}`;
}

export function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
