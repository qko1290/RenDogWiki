'use client';

import React, { useState } from 'react';
import { ReactEditor, useSlateStatic } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { Transforms } from 'slate';

import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';

import type { PriceTableCardElement } from '@/types/slate';
import type { PriceTableEditState } from '../types';

import PriceTableBlock from '@/components/wiki-render/blocks/PriceTableBlock';
import PriceTableRenderer from '@/components/wiki-render/price-table/PriceTableRenderer';
import { useLivePriceTableItems } from '@/components/wiki-render/price-table/useLivePriceTableItems';
import { usePriceTableStageState } from '@/components/wiki-render/price-table/usePriceTableStageState';

import PriceItemSelectModal from '../../PriceItemSelectModal';

import { usePriceTableBlockGuard } from './usePriceTableBlockGuard';
import { usePriceTableEditorActions } from './usePriceTableEditorActions';

export interface PriceTableEditorAdapterProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: PriceTableCardElement;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
}

export default function PriceTableEditorAdapter({
  attributes,
  children,
  element,
  setPriceTableEdit,
}: PriceTableEditorAdapterProps) {
  const editor = useSlateStatic();
  const el = element as PriceTableCardElement;

  usePriceTableBlockGuard(editor);

  const sourceItems = Array.isArray(el.items) ? el.items : [];

  const [imageEditIndex, setImageEditIndex] = useState<number | null>(null);
  const [selectEditIndex, setSelectEditIndex] = useState<number | null>(null);

  const {
    handleImageSelected,
    handlePickItem,
    openPriceEdit,
    removeBlock,
  } = usePriceTableEditorActions({
    editor,
    element: el,
    setPriceTableEdit,
    imageEditIndex,
    setImageEditIndex,
    selectEditIndex,
    setSelectEditIndex,
  });

  const viewItems = useLivePriceTableItems(sourceItems as any[]);

  const {
    hoveredIndex: hovered,
    setHoveredIndex: setHovered,
    stageIndexes: stageIdxArr,
    onPrevStage: handlePrev,
    onNextStage: handleNext,
  } = usePriceTableStageState(sourceItems);

  const deleteButton = (
    <button
      type="button"
      aria-label="시세표 블럭 삭제"
      title="시세표 블럭 삭제"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();

        removeBlock();
      }}
      style={{
        background: 'var(--surface-elevated)',
        color: '#d34b4b',
        border: '1.2px solid #e6b7b7',
        borderRadius: '50%',
        width: 26,
        height: 26,
        fontWeight: 900,
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'background .13s',
        padding: 0,
      }}
    >
      ×
    </button>
  );

  const content = (
    <>
      <PriceTableRenderer
        mode="edit"
        items={viewItems}
        stageIndexes={stageIdxArr}
        hoveredIndex={hovered}
        onHoverIndexChange={setHovered}
        onPrevStage={handlePrev}
        onNextStage={handleNext}
        resolveImageSrc={(src) =>
          src.startsWith('http') ? toProxyUrl(src) : src
        }
        onImageClick={(_, idx, event) => {
          event.stopPropagation();
          setImageEditIndex(idx);
        }}
        onNameClick={(_, idx, event) => {
          event.stopPropagation();

          try {
            Transforms.deselect(editor);
          } catch {}

          setSelectEditIndex(idx);
        }}
        onPriceClick={(item, idx, event) => {
          event.stopPropagation();
          openPriceEdit(item, idx);
        }}
      />

      <ImageSelectModal
        open={imageEditIndex != null}
        onClose={() => setImageEditIndex(null)}
        onSelectImage={handleImageSelected}
      />

      <PriceItemSelectModal
        open={selectEditIndex != null}
        onClose={() => setSelectEditIndex(null)}
        onSelect={handlePickItem}
      />
    </>
  );

  return (
    <PriceTableBlock
      mode="edit"
      attributes={attributes as React.HTMLAttributes<HTMLDivElement>}
      content={content}
      editControls={deleteButton}
    >
      {children}
    </PriceTableBlock>
  );
}