import type { PublicUser } from "@slashslack/shared";
import { useUi } from "../store";
import { colorFor, initials } from "../lib/util";

export function Avatar({ user, size = 36 }: { user: PublicUser; size?: number }) {
  const presence = useUi((s) => s.presence[user.id]);
  const status = presence ?? user.status; // "online" | "away" | "offline"
  const dotColor =
    status === "online" ? "var(--success)" : status === "away" ? "#e0a82e" : "var(--fg-muted)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="rounded-theme object-cover w-full h-full"
        />
      ) : (
        <div
          className="rounded-theme flex items-center justify-center text-white font-semibold w-full h-full"
          style={{ background: colorFor(user.displayName), fontSize: size * 0.4 }}
        >
          {initials(user.displayName)}
        </div>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
        style={{
          width: size * 0.32,
          height: size * 0.32,
          background: dotColor,
          borderColor: "var(--bg)",
        }}
      />
    </div>
  );
}
