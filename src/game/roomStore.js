/** In-memory room registry. Replace with Redis/DB for horizontal scale. */

export class RoomStore {
  #rooms = new Map();

  normalizeCode(code) {
    return code?.toUpperCase() ?? null;
  }

  get(code) {
    const key = this.normalizeCode(code);
    return key ? this.#rooms.get(key) ?? null : null;
  }

  has(code) {
    return this.#rooms.has(this.normalizeCode(code));
  }

  set(room) {
    this.#rooms.set(room.code, room);
    return room;
  }

  delete(code) {
    return this.#rooms.delete(this.normalizeCode(code));
  }

  /** @param {(room: object) => boolean} predicate */
  findAvailableCode(generateCode, predicate) {
    let code;
    do {
      code = generateCode();
    } while (predicate(code));
    return code;
  }
}
