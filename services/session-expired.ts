type SessionExpiredHandler = () => void | Promise<void>;

let handler: SessionExpiredHandler | null = null;
let notifying = false;
let showLoginHint = false;

/**
 * AuthProvider registers a handler that clears the local session.
 * API clients call `notifySessionExpired` after authenticated 401s.
 */
export function registerSessionExpiredHandler(next: SessionExpiredHandler | null) {
  handler = next;
  return () => {
    if (handler === next) {
      handler = null;
    }
  };
}

export function notifySessionExpired() {
  showLoginHint = true;

  if (notifying || !handler) {
    return;
  }

  notifying = true;
  Promise.resolve(handler())
    .catch(() => undefined)
    .finally(() => {
      notifying = false;
    });
}

/** Login screen reads this once after forced sign-out. */
export function consumeSessionExpiredLoginHint() {
  if (!showLoginHint) {
    return false;
  }

  showLoginHint = false;
  return true;
}
