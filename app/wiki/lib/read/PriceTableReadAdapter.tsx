'use client';

import React from 'react';

import PriceTableRenderer from '@/components/wiki-render/price-table/PriceTableRenderer';
import type { PriceTableRawItem } from '@/components/wiki-render/price-table/types';
import { usePriceTableStageState } from '@/components/wiki-render/price-table/usePriceTableStageState';

type PriceTableReadAdapterProps = {
  node: any;
};

function getPriceTableItems(node: any): PriceTableRawItem[] {
  return Array.isArray(node?.items) ? node.items : [];
}

export default function PriceTableReadAdapter({
  node,
}: PriceTableReadAdapterProps) {
  const items = React.useMemo(
    () => getPriceTableItems(node),
    [node],
  );

  const {
    hoveredIndex,
    setHoveredIndex,
    stageIndexes,
    onPrevStage,
    onNextStage,
  } = usePriceTableStageState(items);

  if (items.length === 0) {
    return null;
  }

  return (
    <PriceTableRenderer
      mode="read"
      items={items}
      hoveredIndex={hoveredIndex}
      stageIndexes={stageIndexes}
      onHoverIndexChange={setHoveredIndex}
      onPrevStage={onPrevStage}
      onNextStage={onNextStage}
    />
  );
}