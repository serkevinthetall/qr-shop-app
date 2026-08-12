type ServerDownListener = () => void;

const listeners = new Set<ServerDownListener>();

export function subscribeServerDown(listener: ServerDownListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function emitServerDown() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors.
    }
  }
}
