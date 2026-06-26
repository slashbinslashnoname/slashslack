import * as Lucide from "lucide-react";
import { Hash } from "lucide-react";

function toPascal(name: string) {
  return name
    .split(/[-_\s]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** Render either an emoji (if the key is an emoji) or a named lucide icon. */
export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  if (EMOJI_RE.test(name)) {
    return <span style={{ fontSize: size }} className={className}>{name}</span>;
  }
  const Comp = (Lucide as any)[toPascal(name)] as
    | ((p: any) => JSX.Element)
    | undefined;
  const Final = Comp || Hash;
  return <Final size={size} className={className} />;
}

/** Curated set of icon keys offered in the admin picker. */
export const ICON_CHOICES = [
  "hash", "megaphone", "coffee", "folder", "star", "rocket", "bug", "code",
  "palette", "music", "camera", "heart", "flame", "zap", "bell", "book",
  "briefcase", "calendar", "globe", "shield", "smile", "users", "wrench", "lightbulb",
];
