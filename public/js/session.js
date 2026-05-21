import { STORAGE_KEYS } from './config.js';

export function getPlayerId() {
  let id = localStorage.getItem(STORAGE_KEYS.playerId);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(STORAGE_KEYS.playerId, id);
  }
  return id;
}

export function saveSession(roomCode, playerName, phase) {
  if (!roomCode || !playerName) return;
  localStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify({
      roomCode: String(roomCode).toUpperCase(),
      playerName,
      phase: phase ?? null,
    })
  );
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
  try {
    sessionStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    /* legacy cleanup */
  }
}

export function loadSession() {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) {
      const legacy = sessionStorage.getItem(STORAGE_KEYS.session);
      if (legacy) {
        localStorage.setItem(STORAGE_KEYS.session, legacy);
        sessionStorage.removeItem(STORAGE_KEYS.session);
        raw = legacy;
      }
    }
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}
