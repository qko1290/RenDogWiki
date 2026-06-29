'use client';

import React from 'react';

import PriceTableRenderer from './PriceTableRenderer';
import type { PriceTableRawItem } from './types';
import { usePriceTableStageState } from './usePriceTableStageState';

type PriceTableReadProps = {
  node: any;
};

function getPriceTableItems(node: any): PriceTableRawItem[] {
  return Array.isArray(node?.items) ? node.items : [];
}

export default function PriceTableRead({ node }: PriceTableReadProps) {
  const items = React.useMemo(() => getPriceTableItems(node), [node]);

  const {
    hoveredIndex,
    setHoveredIndex,
    stageIndexes,
    onPrevStage,
    onNextStage,
  } = usePriceTableStageState(items);

  if (items.length === 0) return null;

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