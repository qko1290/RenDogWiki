// =============================================
// File: app/wiki/lib/cache.ts
// (전체 코드)
// - 인스턴스 로컬 TTL 캐시
// - stale-on-error 지원
// - invalidate(tag) 지원
// - unstable_cache / revalidateTag 비사용
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
}

function getStore() {
  if (!global.__wiki_local_cache__) {
    global.__wiki_local_cache__ = new Map<string, CacheEntry>();
  }
  return global.__wiki_local_cache__;
}

export function cacheKey(...parts: (string | number | null | undefined)[]) {
  return parts.filter((x) => x !== null && x !== undefined).join(':');
}

/**
 * 결과 캐시
 * - ttlSec <= 0 이면 캐시 우회
 * - fresh 실패 시 stale 반환
 */
export async function cached<T>(
  key: string,
  options: { ttlSec?: number; tags?: string[] } = {},
  fn?: Fn<T>
): Promise<T> {
  const ttl = options.ttlSec ?? 300;
  const tags = options.tags ?? [];

  if (!fn) {
    throw new Error('cached() requires fn');
  }

  if (ttl <= 0) {
    return await Promise.resolve().then(fn);
  }

  const store = getStore();
  const now = Date.now();
  const hit = store.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  try {
    const value = await Promise.resolve().then(fn);

    store.set(key, {
      value,
      expiresAt: now + ttl * 1000,
      tags,
    });

    return value;
  } catch (err) {
    if (hit) {
      console.warn('[cache] fresh load failed, serving stale:', key, err);
      return hit.value as T;
    }
    throw err;
  }
}

export function invalidate(...tags: string[]) {
  if (!tags.length) return;

  const store = getStore();

  for (const [key, entry] of store.entries()) {
    if (entry.tags.some((t) => tags.includes(t))) {
      store.delete(key);
    }
  }
}