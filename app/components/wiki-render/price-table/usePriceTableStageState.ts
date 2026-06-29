'use client';

import React from 'react';

import type { PriceTableRawItem } from './types';

export function getPriceTableSignature(items: PriceTableRawItem[]) {
  return items
    .map((item, index) => {
      return [
        index,
        item.id ?? '',
        item.name_key ?? item.nameKey ?? '',
        item.name ?? '',
        item.mode ?? '',
        Array.isArray(item.prices) ? item.prices.join(',') : '',
        Array.isArray(item.latestPrices) ? item.latestPrices.join(',') : '',
        Array.isArray(item.stages) ? item.stages.join(',') : '',
      ].join(':');
    })
    .join('|');
}

export function usePriceTableStageState(items: PriceTableRawItem[]) {
  const signature = React.useMemo(
    () => getPriceTableSignature(items),
    [items],
  );

  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const [stageIndexes, setStageIndexes] = React.useState<number[]>(() =>
    items.map(() => 0),
  );

  React.useEffect(() => {
    setHoveredIndex(null);
    setStageIndexes(items.map(() => 0));
  }, [signature]);

  const moveStage = React.useCallback(
    (index: number, delta: number, stageLength: number) => {
      if (!Number.isFinite(index)) return;
      if (!Number.isFinite(stageLength) || stageLength <= 0) return;

      setStageIndexes((prev) => {
        const next = items.map((_, i) => prev[i] ?? 0);
        const current = next[index] ?? 0;

        next[index] = (current + delta + stageLength) % stageLength;

        return next;
      });
    },
    [items],
  );

  const onPrevStage = React.useCallback(
    (index: number, stageLength: number) => {
      moveStage(index, -1, stageLength);
    },
    [moveStage],
  );

  const onNextStage = React.useCallback(
    (index: number, stageLength: number) => {
      moveStage(index, 1, stageLength);
    },
    [moveStage],
  );

  return {
    hoveredIndex,
    setHoveredIndex,
    stageIndexes,
    setStageIndexes,
    moveStage,
    onPrevStage,
    onNextStage,
  };
}