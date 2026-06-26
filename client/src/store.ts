import { create } from "zustand";
import type { PresenceStatus, PublicUser } from "@slashslack/shared";

interface TypingEntry {
  user: PublicUser;
  at: number;
}

interface UiState {
  presence: Record<number, PresenceStatus>;
  typing: Record<string, TypingEntry[]>; // key: "channel:ID" | "dm:ID"
  setPresence: (userId: number, status: PresenceStatus) => void;
  addTyping: (key: string, user: PublicUser) => void;
  pruneTyping: () => void;
}

export const useUi = create<UiState>((set, get) => ({
  presence: {},
  typing: {},
  setPresence: (userId, status) =>
    set((s) => ({ presence: { ...s.presence, [userId]: status } })),
  addTyping: (key, user) =>
    set((s) => {
      const list = (s.typing[key] || []).filter((t) => t.user.id !== user.id);
      list.push({ user, at: Date.now() });
      return { typing: { ...s.typing, [key]: list } };
    }),
  pruneTyping: () => {
    const now = Date.now();
    const next: Record<string, TypingEntry[]> = {};
    for (const [k, list] of Object.entries(get().typing)) {
      const kept = list.filter((t) => now - t.at < 4000);
      if (kept.length) next[k] = kept;
    }
    set({ typing: next });
  },
}));
