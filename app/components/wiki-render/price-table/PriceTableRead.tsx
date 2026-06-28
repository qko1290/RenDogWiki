'use client';

import React from 'react';

import PriceTableRenderer from './PriceTableRenderer';
import type { PriceTableRawItem } from './types';

type PriceTableReadProps = {
  node: any;
};

function getPriceTableItems(node: any): PriceTableRawItem[] {
  return Array.isArray(node?.items) ? node.items : [];
}

function getPriceTableSignature(items: PriceTableRawItem[]) {
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

export default function PriceTableRead({ node }: PriceTableReadProps) {
  const items = React.useMemo(() => getPriceTableItems(node), [node]);

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
  }, [signature, items]);

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

  if (items.length === 0) return null;

  return (
    <PriceTableRenderer
      mode="read"
      items={items}
      hoveredIndex={hoveredIndex}
      stageIndexes={stageIndexes}
      onHoverIndexChange={setHoveredIndex}
      onPrevStage={(index, stageLength) => {
        moveStage(index, -1, stageLength);
      }}
      onNextStage={(index, stageLength) => {
        moveStage(index, 1, stageLength);
      }}
    />
  );
}