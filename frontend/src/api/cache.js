const cache = new Map();

function now() {
  return Date.now();
}

export async function cachedRequest(key, loader, { ttl = 60_000 } = {}) {
  const current = cache.get(key);
  if (current?.value !== undefined && current.expiresAt > now()) return current.value;
  if (current?.promise) return current.promise;

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: now() + ttl, promise: null });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { value: current?.value, expiresAt: current?.expiresAt || 0, promise });
  return promise;
}

export function invalidateCache(prefix = "") {
  for (const key of cache.keys()) {
    if (!prefix || key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearApiCache() {
  cache.clear();
}
