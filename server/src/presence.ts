/** In-memory presence: counts active sockets per user. */
class Presence {
  private counts = new Map<number, number>();

  connect(userId: number): boolean {
    const next = (this.counts.get(userId) || 0) + 1;
    this.counts.set(userId, next);
    return next === 1; // became online
  }

  disconnect(userId: number): boolean {
    const next = (this.counts.get(userId) || 1) - 1;
    if (next <= 0) {
      this.counts.delete(userId);
      return true; // went offline
    }
    this.counts.set(userId, next);
    return false;
  }

  isOnline(userId: number) {
    return this.counts.has(userId);
  }

  onlineIds() {
    return [...this.counts.keys()];
  }
}

export const presence = new Presence();
