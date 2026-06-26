import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DmConversation, PublicUser } from "@slashslack/shared";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { useUsers } from "../lib/queries";

export function NewDmModal({
  me,
  onClose,
  onCreated,
}: {
  me: PublicUser;
  onClose: () => void;
  onCreated: (scope: string) => void;
}) {
  const { data: users = [] } = useUsers();
  const [selected, setSelected] = useState<number[]>([]);
  const qc = useQueryClient();

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const start = async () => {
    if (!selected.length) return;
    const { dm } = await api.post<{ dm: DmConversation }>("/api/dms", { userIds: selected });
    await qc.invalidateQueries({ queryKey: ["dms"] });
    onCreated(`dm:${dm.id}`);
    onClose();
  };

  return (
    <Modal title="New direct message" onClose={onClose}>
      <div className="flex flex-col gap-1 mb-4">
        {users
          .filter((u) => u.id !== me.id)
          .map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className="flex items-center gap-3 px-2 py-2 rounded-theme hover:bg-sidebar-active/10"
              style={{ background: selected.includes(u.id) ? "color-mix(in srgb, var(--accent) 12%, transparent)" : undefined }}
            >
              <Avatar user={u} size={32} />
              <span>{u.displayName}</span>
              {selected.includes(u.id) && <span className="ml-auto text-accent">✓</span>}
            </button>
          ))}
      </div>
      <button
        onClick={start}
        disabled={!selected.length}
        className="bg-accent text-accent-fg px-4 py-2 rounded-theme w-full disabled:opacity-50"
      >
        Start conversation
      </button>
    </Modal>
  );
}
