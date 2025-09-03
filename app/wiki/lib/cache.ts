// app/wiki/lib/cache.ts
import { unstable_cache as uc, revalidateTag } from 'next/cache';

type Fn<T> = () => Promise<T> | T;

export function cacheKey(...parts: (string | number | null | undefined)[]) {
  return parts.filter((x) => x !== null && x !== undefined).join(':');
}

/** 결과 캐시(Next Route Cache) + 태그 묶기 */
export function cached<T>(
  key: string,
  options: { ttlSec?: number; tags?: string[] } = {},
  fn?: Fn<T>
) {
  const ttl = options.ttlSec ?? 300;
  const tags = options.tags ?? [];
  // uc(fn, keys, { revalidate, tags })
  return uc(async () => {
    if (!fn) throw new Error('cached() requires fn');
    return await fn();
  }, [key], { revalidate: ttl, tags })();
}

export function invalidate(...tags: string[]) {
  for (const t of tags) revalidateTag(t);
}