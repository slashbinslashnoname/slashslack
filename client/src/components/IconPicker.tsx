import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon, ICON_CHOICES } from "./Icon";

/** Button showing the current icon; opens a grid popover of real icons. */
export function IconPicker({
  value,
  onChange,
  size = 18,
}: {
  value: string;
  onChange: (icon: string) => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 border border-border rounded-theme px-2 py-1.5 bg-elev hover:bg-sidebar-active/10"
        title="Choose an icon"
      >
        <Icon name={value} size={size} />
        <ChevronDown size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 bg-elev border border-border rounded-theme shadow-lg p-2 grid grid-cols-6 gap-1 w-60">
            {ICON_CHOICES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className="p-2 rounded-theme hover:bg-sidebar-active/15 flex items-center justify-center"
                style={{
                  background: value === k ? "color-mix(in srgb, var(--accent) 16%, transparent)" : undefined,
                  color: value === k ? "var(--accent)" : undefined,
                }}
                title={k}
              >
                <Icon name={k} size={18} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
