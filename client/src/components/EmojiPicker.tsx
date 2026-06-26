const EMOJIS = [
  "👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😍",
  "😅", "🤔", "😎", "😢", "😡", "🥳", "✅", "❌",
  "👀", "💯", "🚀", "⭐", "💡", "☕", "🍕", "🎯",
];

/** Presentational emoji grid. Positioning + close handled by the parent (HoverMenu). */
export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="bg-elev border border-border rounded-theme shadow-lg p-2 grid grid-cols-8 gap-1 w-64">
      {EMOJIS.map((e) => (
        <button key={e} className="text-xl hover:bg-sidebar-active/20 rounded p-1" onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}
