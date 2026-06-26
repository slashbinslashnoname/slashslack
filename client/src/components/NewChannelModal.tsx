import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Category, Channel } from "@slashslack/shared";
import { Hash, Lock, Search } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { IconPicker } from "./IconPicker";
import { useCategories, useChannels } from "../lib/queries";

export function NewChannelModal({
  presetCategoryId = null,
  onClose,
  onCreated,
}: {
  presetCategoryId?: number | null;
  onClose: () => void;
  onCreated: (scope: string) => void;
}) {
  const [tab, setTab] = useState<"browse" | "create">("browse");

  return (
    <Modal title="Channels" onClose={onClose}>
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["browse", "create"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-sm -mb-px border-b-2"
            style={{
              borderColor: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--fg-muted)",
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === "browse" ? "Browse channels" : "Create channel"}
          </button>
        ))}
      </div>
      {tab === "browse" ? (
        <Browse onClose={onClose} onCreated={onCreated} />
      ) : (
        <Create presetCategoryId={presetCategoryId} onClose={onClose} onCreated={onCreated} />
      )}
    </Modal>
  );
}

function Browse({ onClose, onCreated }: { onClose: () => void; onCreated: (s: string) => void }) {
  const { data: channels = [] } = useChannels();
  const [q, setQ] = useState("");
  const filtered = channels.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.topic.toLowerCase().includes(q.toLowerCase()),
  );

  const open = async (c: Channel) => {
    await api.post(`/api/channels/${c.id}/join`).catch(() => {});
    onCreated(`channel:${c.id}`);
    onClose();
  };

  return (
    <div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-2 top-2.5 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search channels…"
          className="w-full border border-border rounded-theme pl-8 pr-3 py-2 bg-elev"
        />
      </div>
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto scroll-thin">
        {filtered.length === 0 && <div className="text-muted text-sm py-4 text-center">No channels found.</div>}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => open(c)}
            className="flex items-center gap-2 px-2 py-2 rounded-theme hover:bg-sidebar-active/10 text-left"
          >
            {c.isPrivate ? <Lock size={16} /> : <Icon name={c.icon} size={16} />}
            <div className="min-w-0">
              <div className="font-medium">{c.name}</div>
              {c.topic && <div className="text-xs text-muted truncate">{c.topic}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Create({
  presetCategoryId,
  onClose,
  onCreated,
}: {
  presetCategoryId: number | null;
  onClose: () => void;
  onCreated: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [icon, setIcon] = useState("hash");
  const [isPrivate, setPrivate] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(presetCategoryId);
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();

  const create = async () => {
    if (!name.trim()) return;
    const { channel } = await api.post<{ channel: Channel }>("/api/channels", {
      name,
      topic,
      icon,
      isPrivate,
      categoryId,
    });
    await qc.invalidateQueries({ queryKey: ["channels"] });
    onCreated(`channel:${channel.id}`);
    onClose();
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. marketing"
        className="w-full border border-border rounded-theme px-3 py-2 mb-3 bg-elev"
      />
      <label className="block text-sm font-medium mb-1">Topic</label>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        className="w-full border border-border rounded-theme px-3 py-2 mb-3 bg-elev"
      />
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border border-border rounded-theme px-3 py-2 bg-elev"
          >
            <option value="">No category</option>
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      </div>
      <label className="flex items-center gap-2 mb-4">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        <span className="text-sm">Private channel</span>
      </label>
      <button onClick={create} className="bg-accent text-accent-fg px-4 py-2 rounded-theme w-full">
        Create channel
      </button>
    </div>
  );
}
