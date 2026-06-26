import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-24"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-border rounded-theme shadow-xl w-full mx-4"
        style={{ maxWidth: wide ? 720 : 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto scroll-thin">{children}</div>
      </div>
    </div>
  );
}
