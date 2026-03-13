// =============================================
// File: app/wiki/lib/cache.ts
// (전체 코드)
// - unstable_cache 래퍼
// - ttlSec <= 0 이면 캐시 우회
// - invalidate(tag) 유틸 제공
// =============================================

import { unstable_cache as uc, revalidateTag } from 'next/cache';

type Fn<T> = () => Promise<T> | T;

export function cacheKey(...parts: (string | number | null | undefined)[]) {
  return parts.filter((x) => x !== null && x !== undefined).join(':');
}

/**
 * 결과 캐시(Next Route Cache) + 태그 묶기
 * - ttlSec <= 0 이면 캐시 완전 우회
 */
export function cached<T>(
  key: string,
  options: { ttlSec?: number; tags?: string[] } = {},
  fn?: Fn<T>
) {
  const ttl = options.ttlSec ?? 300;
  const tags = options.tags ?? [];

  if (!fn) throw new Error('cached() requires fn');

  if (ttl <= 0) {
    return Promise.resolve().then(fn);
  }

  return uc(async () => await fn(), [key], {
    revalidate: ttl,
    tags,
  })();
}

export function invalidate(...tags: string[]) {
  for (const t of tags) {
    try {
      revalidateTag(t);
    } catch (e) {
      console.error('[cache.invalidate] failed:', t, e);
    }
  }
}