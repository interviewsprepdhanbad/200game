import { $ } from './dom.js';
import { TOAST_MS } from '../config.js';

let hideTimer = null;

export function showToast(message) {
  const el = $('#game-message');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.add('hidden'), TOAST_MS);
}
