'use client';

import React from 'react';

import type { PriceTableRawItem } from './types';

import {
  fetchLatestPriceItem,
  makePriceCacheKey,
  normalizePickedPrices,
  type PickedPriceItem,
} from './priceTableLiveService';

type PriceTableItemLike = PriceTableRawItem & Record<string, any>;

function getLivePriceTableSignature(items: PriceTableItemLike[]) {
  return items
    .map((item, index) => {
      const key = makePriceCacheKey(
        item?.id ?? null,
        item?.name_key ?? item?.nameKey ?? null,
      );

      return `${index}:${key}`;
    })
    .filter(Boolean)
    .join('|');
}

export function useLivePriceTableItems<T extends PriceTableItemLike>(
  items: T[],
): T[] {
  const signature = React.useMemo(
    () => getLivePriceTableSignature(items),
    [items],
  );

  const [liveMap, setLiveMap] = React.useState<Map<string, PickedPriceItem>>(
    () => new Map(),
  );

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const targets = items
        .map((item) => {
          const key = makePriceCacheKey(
            item?.id ?? null,
            item?.name_key ?? item?.nameKey ?? null,
          );

          return {
            key,
            id: item?.id ?? null,
            nameKey: item?.name_key ?? item?.nameKey ?? null,
          };
        })
        .filter((target) => !!target.key);

      if (targets.length === 0) {
        if (alive) setLiveMap(new Map());
        return;
      }

      const results = await Promise.all(
        targets.map(async (target) => {
          const latest = await fetchLatestPriceItem(
            target.id,
            target.nameKey,
          );

          return {
            key: target.key,
            latest,
          };
        }),
      );

      if (!alive) return;

      const next = new Map<string, PickedPriceItem>();

      for (const result of results) {
        if (result.latest) {
          next.set(result.key, result.latest);
        }
      }

      setLiveMap(next);
    })();

    return () => {
      alive = false;
    };
  }, [signature, items]);

  return React.useMemo(() => {
    return items.map((item) => {
      const key = makePriceCacheKey(
        item?.id ?? null,
        item?.name_key ?? item?.nameKey ?? null,
      );

      const latest = key ? liveMap.get(key) : null;

      if (!latest) return item;

      const normalized = normalizePickedPrices(latest);

      return {
        ...item,
        id: latest.id ?? item.id,
        name: latest.name ?? item.name,
        name_key: latest.name_key ?? item.name_key,
        mode: latest.mode ?? item.mode,
        stages: normalized.stages,
        prices: normalized.prices,
      };
    }) as T[];
  }, [items, liveMap]);
}