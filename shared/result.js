/** Small Result helpers for service-layer return values. */

export function success(value) {
  return { ok: true, value };
}

export function failure(error) {
  return { ok: false, error };
}
