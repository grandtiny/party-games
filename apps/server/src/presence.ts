export class PresenceTracker {
  readonly #connections = new Map<string, Map<string, number>>();

  connect(roomCode: string, playerId: string): void {
    const room = this.#connections.get(roomCode) ?? new Map<string, number>();
    room.set(playerId, (room.get(playerId) ?? 0) + 1);
    this.#connections.set(roomCode, room);
  }

  disconnect(roomCode: string, playerId: string): void {
    const room = this.#connections.get(roomCode);
    if (!room) return;

    const count = (room.get(playerId) ?? 1) - 1;
    if (count <= 0) room.delete(playerId);
    else room.set(playerId, count);

    if (room.size === 0) this.#connections.delete(roomCode);
  }

  isConnected(roomCode: string, playerId: string): boolean {
    return (this.#connections.get(roomCode)?.get(playerId) ?? 0) > 0;
  }
}
