const EMOJIS = [
  "👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😍",
  "😅", "🤔", "😎", "😢", "😡", "🥳", "✅", "❌",
  "👀", "💯", "🚀", "⭐", "💡", "☕", "🍕", "🎯",
];

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div
      className="absolute z-30 bottom-full mb-1 right-0 bg-elev border border-border rounded-theme shadow-lg p-2 grid grid-cols-8 gap-1 w-64"
      onMouseLeave={onClose}
    >
      {EMOJIS.map((e) => (
        <button
          key={e}
          className="text-xl hover:bg-sidebar-active/20 rounded p-1"
          onClick={() => {
            onPick(e);
            onClose();
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
