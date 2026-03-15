// =============================================
// File: app/wiki/lib/cache.ts
// (전체 코드)
// - 인스턴스 로컬 TTL 캐시
// - stale-on-error 지원
// - invalidate(tag) 지원
// - 같은 key 동시 요청은 inflight dedupe(single-flight)
// =============================================

type Fn<T> = () => Promise<T> | T;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  tags: string[];
};

declare global {
  // eslint-disable-next-line no-var
  var __wiki_local_cache__: Map<string, CacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __wiki_local_cache_pending__: Map<string, Promise<unknown>> | undefined;
}

function getStore() {
  if (!global.__wiki_local_cache__) {
    global.__wiki_local_cache__ = new Map<string, CacheEntry>();
  }
  return global.__wiki_local_cache__;
}

function getPendingStore() {
  if (!global.__wiki_local_cache_pending__) {
    global.__wiki_local_cache_pending__ = new Map<string, Promise<unknown>>();
  }
  return global.__wiki_local_cache_pending__;
}

export function cacheKey(...parts: (string | number | null | undefined)[]) {
  return parts.filter((x) => x !== null && x !== undefined).join(':');
}

export async function cached<T>(
  key: string,
  options: { ttlSec?: number; tags?: string[] } = {},
  fn?: Fn<T>
): Promise<T> {
  const ttl = options.ttlSec ?? 300;
  const tags = options.tags ?? [];

  if (!fn) throw new Error('cached() requires fn');

  if (ttl <= 0) {
    return await Promise.resolve().then(fn);
  }

  const store = getStore();
  const pendingStore = getPendingStore();
  const now = Date.now();
  const hit = store.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const pending = pendingStore.get(key);
  if (pending) {
    return (await pending) as T;
  }

  const loader = Promise.resolve()
    .then(fn)
    .then((value) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
        tags,
      });
      return value;
    })
    .catch((err) => {
      if (hit) {
        console.warn('[cache] fresh load failed, serving stale:', key, err);
        return hit.value as T;
      }
      throw err;
    })
    .finally(() => {
      pendingStore.delete(key);
    });

  pendingStore.set(key, loader as Promise<unknown>);
  return await loader;
}

export function invalidate(...tags: string[]) {
  if (!tags.length) return;

  const store = getStore();
  const pendingStore = getPendingStore();

  for (const [key, entry] of store.entries()) {
    if (entry.tags.some((t) => tags.includes(t))) {
      store.delete(key);
      pendingStore.delete(key);
    }
  }
}