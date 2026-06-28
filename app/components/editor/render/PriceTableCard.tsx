// =============================================
// File: components/editor/render/PriceTableCard.tsx  (전체 코드 / 수정본)
// - ✅ 렌더링 시점에 DB에서 최신 시세를 가져와 "표시용"으로 반영
// - ✅ 저장 없이도 최신 시세가 보이도록 Slate 문서 자체는 건드리지 않음
// - ✅ 간단 캐시(TTL) + in-flight dedupe로 과도한 요청 방지
// - ✅ 카드 UI는 공통 PriceTableRenderer 사용
// - ✅ 에디터 전용 동작은 이 파일에 유지
// =============================================
import React, { useEffect, useMemo, useState } from 'react';
import { ReactEditor, useSlateStatic } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { Editor, Element as SlateElement, Transforms } from 'slate';

import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';

import type { PriceTableCardElement } from '@/types/slate';
import type { PriceTableEditState } from './types';
import PriceTableBlock from '@/components/wiki-render/blocks/PriceTableBlock';
import PriceTableRenderer from '@/components/wiki-render/price-table/PriceTableRenderer';

import PriceItemSelectModal from '../PriceItemSelectModal';

import {
  normalizePickedPrices,
  type PickedPriceItem,
} from '@/components/wiki-render/price-table/priceTableLiveService';

import { useLivePriceTableItems } from '@/components/wiki-render/price-table/useLivePriceTableItems';

import { usePriceTableStageState } from '@/components/wiki-render/price-table/usePriceTableStageState';

// -------------------- 메인 렌더러 --------------------

export interface PriceTableCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: PriceTableCardElement;
  editor: any;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
}

export function PriceTableCard(props: PriceTableCardProps) {
  const { attributes, children, element, setPriceTableEdit } = props;
  const editorStatic = useSlateStatic();
  const el = element as PriceTableCardElement;
  const path = ReactEditor.findPath(editorStatic, el);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { selection } = editorStatic;

      if (!selection || !ReactEditor.isFocused(editorStatic)) return;

      const [node] = Editor.node(editorStatic, selection, { depth: 1 });

      if (
        SlateElement.isElement(node) &&
        (node as any).type === 'price-table-card' &&
        e.key === 'Backspace'
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler, true);

    return () => window.removeEventListener('keydown', handler, true);
  }, [editorStatic]);

  const sourceItems = Array.isArray(el.items) ? el.items : [];

  const [imageEditIndex, setImageEditIndex] = useState<number | null>(null);
  const [selectEditIndex, setSelectEditIndex] = useState<number | null>(null);

  const viewItems = useLivePriceTableItems(sourceItems as any[]);

  const {
    hoveredIndex: hovered,
    setHoveredIndex: setHovered,
    stageIndexes: stageIdxArr,
    onPrevStage: handlePrev,
    onNextStage: handleNext,
  } = usePriceTableStageState(sourceItems);

  const patchItemAt = React.useCallback(
    (idx: number, patch: Record<string, any>) => {
      const current = Editor.node(editorStatic, path)[0] as PriceTableCardElement;
      const currentItems = Array.isArray(current.items) ? current.items : [];

      const nextItems = currentItems.map((item: any, i: number) =>
        i === idx ? { ...item, ...patch } : item,
      );

      Transforms.setNodes(
        editorStatic,
        {
          items: nextItems,
        },
        { at: path },
      );
    },
    [editorStatic, path],
  );

  const handleImageSelected = React.useCallback(
    (url: string) => {
      if (imageEditIndex == null) return;

      patchItemAt(imageEditIndex, { image: url });
      setImageEditIndex(null);
    },
    [imageEditIndex, patchItemAt],
  );

  const handlePickItem = React.useCallback(
    (picked: PickedPriceItem) => {
      if (selectEditIndex == null) return;

      const normalized = normalizePickedPrices(picked);

      patchItemAt(selectEditIndex, {
        id: picked.id,
        name: picked.name,
        name_key: picked.name_key,
        mode: picked.mode,
        stages: normalized.stages,
        prices: normalized.prices,
      });

      setSelectEditIndex(null);
    },
    [selectEditIndex, patchItemAt],
  );

  const deleteButton = (
    <button
      type="button"
      aria-label="시세표 블럭 삭제"
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
      title="시세표 블럭 삭제"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();

        const pathToRemove = ReactEditor.findPath(editorStatic, element);

        Transforms.removeNodes(editorStatic, { at: pathToRemove });
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
            Transforms.deselect(editorStatic);
          } catch {}

          setSelectEditIndex(idx);
        }}
        onPriceClick={(item, idx, event) => {
          event.stopPropagation();

          window.dispatchEvent(
            new CustomEvent('editor:capture-scroll:price'),
          );

          setPriceTableEdit({
            blockPath: path,
            idx,
            item: {
              ...item,
              mode: item.mode ?? 'block',
            },
          });
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

export default PriceTableCard;
