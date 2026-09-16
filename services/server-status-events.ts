type ServerDownListener = () => void;

const listeners = new Set<ServerDownListener>();

/** Ignore server-down signals until this timestamp (resume/network warm-up). */
let suppressUntil = 0;

/** Require a few hard failures before locking the UI (Atom is flaky/slow). */
let failureStreak = 0;
const FAILURES_BEFORE_MODAL = 3;

export function suppressServerDownFor(ms: number) {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms);
}

export function isServerDownSuppressed() {
  return Date.now() < suppressUntil;
}

export function noteServerReachable() {
  failureStreak = 0;
}

export function subscribeServerDown(listener: ServerDownListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function emitServerDown() {
  if (isServerDownSuppressed()) {
    return;
  }

  failureStreak += 1;
  if (failureStreak < FAILURES_BEFORE_MODAL) {
    return;
  }

  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors.
    }
  }
}

export function shouldEmitServerDownFromStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

export function shouldEmitServerDownFromError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'AbortError') {
    return false;
  }

  return (
    error.message === 'Network request failed' ||
    error.message.includes('Network Error') ||
    error.message.includes('Failed to fetch')
  );
}
