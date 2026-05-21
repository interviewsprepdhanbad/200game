export const $ = (selector) => document.querySelector(selector);

export const screens = {
  auth: $('#screen-auth'),
  lobby: $('#screen-lobby'),
  game: $('#screen-game'),
};

export function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove('active'));
  screens[name]?.classList.add('active');
}

export function showAuthError(message) {
  const el = $('#auth-error');
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

export function showReconnecting(detail) {
  if (detail) $('#reconnecting-detail').textContent = detail;
  $('#overlay-reconnecting').classList.remove('hidden');
}

export function hideReconnecting() {
  $('#overlay-reconnecting').classList.add('hidden');
}
