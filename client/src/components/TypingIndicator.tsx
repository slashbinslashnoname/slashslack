import type { PublicUser } from "@slashslack/shared";
import { useUi } from "../store";

const EMPTY: { user: PublicUser; at: number }[] = [];

/** Fixed bar (always visible) showing who is currently typing in this scope. */
export function TypingIndicator({ scope, me }: { scope: string; me: PublicUser }) {
  const raw = useUi((s) => s.typing[scope]) ?? EMPTY;
  const typing = raw.filter((t) => t.user.id !== me.id);

  return (
    <div className="h-5 px-4 text-xs text-muted italic flex items-center gap-1">
      {typing.length > 0 && (
        <>
          <span className="inline-flex gap-0.5">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
          <span>
            {typing
              .slice(0, 3)
              .map((t) => t.user.displayName)
              .join(", ")}{" "}
            {typing.length === 1 ? "is typing" : "are typing"}…
          </span>
        </>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1 h-1 rounded-full bg-muted inline-block"
      style={{ animation: "typing-bounce 1s infinite", animationDelay: `${delay}ms` }}
    />
  );
}
