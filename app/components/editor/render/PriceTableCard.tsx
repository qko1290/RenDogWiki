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
import { stagesByFormat } from '@/components/wiki-render/price-table/priceTableViewModel';

import PriceItemSelectModal from '../PriceItemSelectModal';

// -------------------- 선택 모달에서 받는 데이터 타입 --------------------

type PickedPriceItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string;
  prices: string[];
};

// -------------------- 라이브 시세 로딩/캐시 --------------------

const PRICE_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  ts: number;
  item: PickedPriceItem;
};

const priceCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PickedPriceItem | null>>();

function makeCacheKey(id?: number | null, nameKey?: string | null) {
  if (Number.isFinite(id as any) && (id as number) > 0) return `id:${id}`;

  const nk = String(nameKey ?? '').trim();

  if (nk) return `key:${nk}`;

  return '';
}

async function fetchLatestPriceItem(
  id?: number | null,
  nameKey?: string | null,
) {
  const key = makeCacheKey(id, nameKey);

  if (!key) return null;

  const now = Date.now();
  const hit = priceCache.get(key);

  if (hit && now - hit.ts <= PRICE_CACHE_TTL_MS) return hit.item;

  const inFlight = inflight.get(key);

  if (inFlight) return inFlight;

  const p = (async () => {
    try {
      const url = key.startsWith('id:')
        ? `/api/prices/get?id=${encodeURIComponent(String(id))}`
        : `/api/prices/get?name_key=${encodeURIComponent(String(nameKey ?? ''))}`;

      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) return null;

      const data = (await res.json()) as any;
      const it = data?.item;

      if (!it) return null;

      const normalized: PickedPriceItem = {
        id: Number(it.id),
        name: String(it.name ?? ''),
        name_key: String(it.name_key ?? ''),
        mode: String(it.mode ?? ''),
        prices: Array.isArray(it.prices)
          ? it.prices.map((v: any) => String(v ?? ''))
          : [],
      };

      priceCache.set(key, { ts: Date.now(), item: normalized });

      return normalized;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);

  return p;
}

function normalizePickedPrices(picked: PickedPriceItem) {
  const newStages = stagesByFormat(picked.mode);
  const raw = Array.isArray(picked.prices)
    ? picked.prices.map((value) => String(value ?? ''))
    : [];

  const nextPrices = [...raw];
  nextPrices.length = newStages.length;

  for (let i = 0; i < newStages.length; i++) {
    if (typeof nextPrices[i] === 'undefined') nextPrices[i] = '';
  }

  return {
    stages: newStages,
    prices: nextPrices,
  };
}

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

  const [stageIdxArr, setStageIdxArr] = useState<number[]>(() =>
    sourceItems.map(() => 0),
  );
  const [hovered, setHovered] = useState<number | null>(null);
  const [liveMap, setLiveMap] = useState<Map<string, PickedPriceItem>>(
    () => new Map(),
  );
  const [imageEditIndex, setImageEditIndex] = useState<number | null>(null);
  const [selectEditIndex, setSelectEditIndex] = useState<number | null>(null);

  useEffect(() => {
    const nextItems = Array.isArray(el.items) ? el.items : [];

    setStageIdxArr(nextItems.map(() => 0));
    setHovered(null);
  }, [el.items]);

  const itemsSignature = useMemo(() => {
    return (Array.isArray(el.items) ? el.items : [])
      .map((it: any) => makeCacheKey(it?.id ?? null, it?.name_key ?? null))
      .filter(Boolean)
      .join('|');
  }, [el.items]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const items = Array.isArray(el.items) ? el.items : [];
      const targets = items
        .map((it: any) => {
          const key = makeCacheKey(it?.id ?? null, it?.name_key ?? null);

          return {
            key,
            id: it?.id ?? null,
            name_key: it?.name_key ?? null,
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
            target.name_key,
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
        if (result.latest) next.set(result.key, result.latest);
      }

      setLiveMap(next);
    })();

    return () => {
      alive = false;
    };
  }, [itemsSignature, el.items]);

  const viewItems = useMemo(() => {
    const items = Array.isArray(el.items) ? el.items : [];

    return items.map((it: any) => {
      const key = makeCacheKey(it?.id ?? null, it?.name_key ?? null);
      const latest = key ? liveMap.get(key) : null;

      if (!latest) return it;

      const normalized = normalizePickedPrices(latest);

      return {
        ...it,
        id: latest.id ?? it.id,
        name: latest.name ?? it.name,
        name_key: latest.name_key ?? it.name_key,
        mode: latest.mode ?? it.mode,
        stages: normalized.stages,
        prices: normalized.prices,
      };
    });
  }, [el.items, liveMap]);

  const handlePrev = (idx: number, len: number) => {
    if (!Number.isFinite(idx) || !Number.isFinite(len) || len <= 0) return;

    setStageIdxArr((arr) =>
      arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)),
    );
  };

  const handleNext = (idx: number, len: number) => {
    if (!Number.isFinite(idx) || !Number.isFinite(len) || len <= 0) return;

    setStageIdxArr((arr) =>
      arr.map((v, i) => (i === idx ? (v + 1) % len : v)),
    );
  };

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
