type CatalogRefreshListener = () => void;

const listeners = new Set<CatalogRefreshListener>();

export function onCatalogRefreshRequested(listener: CatalogRefreshListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function requestCatalogRefresh() {
  for (const listener of listeners) {
    listener();
  }
}
