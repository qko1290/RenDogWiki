import { stagesByFormat } from './priceTableViewModel';

export type PickedPriceItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string;
  prices: string[];
};

type CacheEntry = {
  ts: number;
  item: PickedPriceItem;
};

const PRICE_CACHE_TTL_MS = 60_000;

const priceCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PickedPriceItem | null>>();

export function makePriceCacheKey(
  id?: number | string | null,
  nameKey?: string | null,
) {
  const numericId = Number(id);

  if (Number.isFinite(numericId) && numericId > 0) {
    return `id:${numericId}`;
  }

  const nk = String(nameKey ?? '').trim();

  if (nk) return `key:${nk}`;

  return '';
}

export async function fetchLatestPriceItem(
  id?: number | string | null,
  nameKey?: string | null,
): Promise<PickedPriceItem | null> {
  const key = makePriceCacheKey(id, nameKey);

  if (!key) return null;

  const now = Date.now();
  const hit = priceCache.get(key);

  if (hit && now - hit.ts <= PRICE_CACHE_TTL_MS) {
    return hit.item;
  }

  const inFlight = inflight.get(key);

  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const url = key.startsWith('id:')
        ? `/api/prices/get?id=${encodeURIComponent(String(id))}`
        : `/api/prices/get?name_key=${encodeURIComponent(String(nameKey ?? ''))}`;

      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) return null;

      const data = (await res.json()) as any;
      const item = data?.item;

      if (!item) return null;

      const normalized: PickedPriceItem = {
        id: Number(item.id),
        name: String(item.name ?? ''),
        name_key: String(item.name_key ?? ''),
        mode: String(item.mode ?? ''),
        prices: Array.isArray(item.prices)
          ? item.prices.map((value: any) => String(value ?? ''))
          : [],
      };

      priceCache.set(key, {
        ts: Date.now(),
        item: normalized,
      });

      return normalized;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);

  return request;
}

export function normalizePickedPrices(picked: PickedPriceItem) {
  const newStages = stagesByFormat(picked.mode);
  const raw = Array.isArray(picked.prices)
    ? picked.prices.map((value) => String(value ?? ''))
    : [];

  const nextPrices = [...raw];

  nextPrices.length = newStages.length;

  for (let i = 0; i < newStages.length; i += 1) {
    if (typeof nextPrices[i] === 'undefined') {
      nextPrices[i] = '';
    }
  }

  return {
    stages: newStages,
    prices: nextPrices,
  };
}