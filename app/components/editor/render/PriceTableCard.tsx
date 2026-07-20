'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import type { PriceTableCardElement } from '@/types/slate';
import type { PriceTableEditState } from './types';

import PriceTableEditorAdapter from './price-table/PriceTableEditorAdapter';

export interface PriceTableCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: PriceTableCardElement;
  editor: any;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
}

export function PriceTableCard({
  attributes,
  children,
  element,
  setPriceTableEdit,
}: PriceTableCardProps) {
  return (
    <PriceTableEditorAdapter
      attributes={attributes}
      element={element}
      setPriceTableEdit={setPriceTableEdit}
    >
      {children}
    </PriceTableEditorAdapter>
  );
}

export default PriceTableCard;