import type { PresenceStatus } from "@slashslack/shared";

/** In-memory presence: active socket counts + a self-reported status per user. */
class Presence {
  private counts = new Map<number, number>();
  private status = new Map<number, "online" | "away">();

  connect(userId: number): boolean {
    const next = (this.counts.get(userId) || 0) + 1;
    this.counts.set(userId, next);
    if (next === 1) this.status.set(userId, "online");
    return next === 1; // became online
  }

  disconnect(userId: number): boolean {
    const next = (this.counts.get(userId) || 1) - 1;
    if (next <= 0) {
      this.counts.delete(userId);
      this.status.delete(userId);
      return true; // went offline
    }
    this.counts.set(userId, next);
    return false;
  }

  /** Set the user's reported status (active vs away). Ignored if offline. */
  setStatus(userId: number, status: "online" | "away") {
    if (this.counts.has(userId)) this.status.set(userId, status);
  }

  isOnline(userId: number) {
    return this.counts.has(userId);
  }

  /** online | away | offline */
  effectiveStatus(userId: number): PresenceStatus {
    if (!this.counts.has(userId)) return "offline";
    return this.status.get(userId) || "online";
  }

  onlineIds() {
    return [...this.counts.keys()];
  }
}

export const presence = new Presence();
