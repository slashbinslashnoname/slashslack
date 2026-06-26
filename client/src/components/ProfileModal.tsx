import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Attachment, PublicUser } from "@slashslack/shared";
import { Upload, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";

export function ProfileModal({ me, onClose }: { me: PublicUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatarUrl);
  const [statusText, setStatusText] = useState(me.statusText ?? "");
  const [busy, setBusy] = useState(false);

  const preview: PublicUser = { ...me, displayName, avatarUrl };

  const uploadAvatar = async (file: File) => {
    const { attachment } = await api.upload<{ attachment: Attachment }>("/api/uploads", file);
    setAvatarUrl(attachment.url);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { user } = await api.patch<{ user: PublicUser }>("/api/users/me", {
        displayName: displayName.trim(),
        avatarUrl,
        statusText: statusText.trim() || null,
      });
      qc.setQueryData(["me"], user);
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <div className="flex items-center gap-4 mb-5">
        <Avatar user={preview} size={64} />
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 border border-border rounded-theme px-3 py-1.5 cursor-pointer hover:bg-elev text-sm">
            <Upload size={15} /> Upload image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </label>
          {avatarUrl && (
            <button
              onClick={() => setAvatarUrl(null)}
              className="flex items-center gap-1 text-sm text-danger hover:underline"
            >
              <Trash2 size={14} /> Remove (use color avatar)
            </button>
          )}
        </div>
      </div>

      <label className="block text-sm font-medium mb-1">Display name</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="w-full border border-border rounded-theme px-3 py-2 mb-3 bg-elev"
      />

      <label className="block text-sm font-medium mb-1">Status</label>
      <input
        value={statusText}
        onChange={(e) => setStatusText(e.target.value)}
        placeholder="e.g. 🌴 On vacation, 🎧 Focusing…"
        maxLength={100}
        className="w-full border border-border rounded-theme px-3 py-2 mb-2 bg-elev"
      />
      <p className="text-xs text-muted mb-4">
        Your color avatar is generated from your name when no image is set.
      </p>

      <button
        onClick={save}
        disabled={busy || !displayName.trim()}
        className="bg-accent text-accent-fg px-4 py-2 rounded-theme w-full disabled:opacity-50"
      >
        Save profile
      </button>
    </Modal>
  );
}
