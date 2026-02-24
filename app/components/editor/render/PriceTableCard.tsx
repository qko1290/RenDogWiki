// =============================================
// File: components/editor/render/PriceTableCard.tsx  (전체 코드 / 수정본)
// - ✅ 렌더링 시점에 DB에서 최신 시세를 가져와 "표시용"으로 반영
// - ✅ 저장 없이도 최신 시세가 보이도록 (Slate 문서 자체는 건드리지 않음)
// - ✅ 간단 캐시(TTL) + in-flight dedupe로 과도한 요청 방지
// =============================================
import React, { useEffect, useMemo, useState } from 'react';
import { ReactEditor, useSlateStatic } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { Editor, Element as SlateElement, Path, Transforms } from 'slate';

import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';

import type { PriceTableCardElement } from '@/types/slate';
import type { PriceTableEditState } from './types';

// ✅ 신규: 이름 클릭 시 아이템 선택 모달
import PriceItemSelectModal from '../PriceItemSelectModal';

// -------------------- 형식/스테이지 정의 --------------------

type PriceFormat =
  | 'block'
  | 'cash'
  | 'limited'
  | 'box'
  | 'armor'
  | 'boss'
  | 'monster'
  | 'title'
  | 'costume'
  | 'fishing'
  | 'scroll'
  | 'rune'
  | 'epic'
  | 'unique'
  | 'legendary'
  | 'divine'
  | 'superior'
  | 'transcend epic'
  | 'transcend unique'
  | 'transcend legendary'
  | 'transcend divine'
  | 'transcend superior';

const SINGLE_PRICE_FORMATS: PriceFormat[] = [
  'block',
  'cash',
  'limited',
  'box',
  'armor',
  'boss',
  'monster',
  'title',
  'costume',
  'fishing',
  'scroll',
  'rune',
];

const AWAKEN_FORMATS: PriceFormat[] = ['epic', 'unique', 'legendary', 'divine', 'superior'];

const TRANSCEND_FORMATS: PriceFormat[] = [
  'transcend epic',
  'transcend unique',
  'transcend legendary',
  'transcend divine',
  'transcend superior',
];

function stagesByFormat(fmt?: string): string[] {
  const f = String(fmt ?? '').trim().toLowerCase() as PriceFormat;

  if (TRANSCEND_FORMATS.includes(f)) return ['거가', '거불'];
  if (AWAKEN_FORMATS.includes(f)) return ['봉인', '1각', '2각', '3각', '4각', 'MAX'];
  return ['가격'];
}

// -------------------- UI 유틸 --------------------

function getPriceBadgeColor(stage: string, _type?: string) {
  switch (stage) {
    case '봉인':
      return '#444';
    case '1각':
    case '2각':
    case '3각':
    case '4각':
      return '#48ea6d';
    case 'MAX':
      return '#ffe360';
    case '거가':
      return '#43b04b';
    case '거불':
      return '#e44c4c';
    default:
      return '#5cacee';
  }
}

function autoFont(base: number, text: string, steps?: Array<[number, number]>) {
  const len = Array.from(text ?? '').length;
  const rules: Array<[number, number]> =
    steps ?? [
      [8, base],
      [12, base - 2],
      [16, base - 4],
      [20, base - 6],
      [26, base - 8],
      [34, base - 9],
    ];
  for (const [threshold, size] of rules) {
    if (len <= threshold) return size;
  }
  return Math.max(11, (rules.at(-1)?.[1] ?? base) - 2);
}

/**
 * ✅ 이름 줄바꿈 규칙 + "줄바꿈 발생 여부"까지 반환
 * - 10글자 이상 + 띄어쓰기 2개 이상이면
 * - 7글자 이후에 처음 등장하는 띄어쓰기 지점부터 줄바꿈
 */
function smartNameBreakInfo(nameRaw: string | null | undefined) {
  const name = String(nameRaw ?? '');
  const chars = Array.from(name);
  const len = chars.length;
  const spaceCount = chars.reduce((acc, ch) => (ch === ' ' ? acc + 1 : acc), 0);

  if (len < 10 || spaceCount < 2) {
    return { node: name as React.ReactNode, broke: false };
  }

  const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === ' ');
  if (breakAt === -1) {
    return { node: name as React.ReactNode, broke: false };
  }

  const first = chars.slice(0, breakAt).join('');
  const second = chars.slice(breakAt + 1).join('');

  if (!second.trim()) {
    return { node: name as React.ReactNode, broke: false };
  }

  return {
    node: (
      <span>
        {first}
        <br />
        {second}
      </span>
    ),
    broke: true,
  };
}

// ✅ PHP(colors.js)와 동일 팔레트: [10강..1강]
const RDW_PALETTE = [
  '#5E2569', // 10
  '#B746F8', // 9
  '#F39C12', // 8
  '#E74C3C', // 7
  '#3498DB', // 6
  '#1ABC9C', // 5
  '#309C49', // 4
  '#F1C40F', // 3
  '#DDB89E', // 2
  '#34495E', // 1
] as const;

function colorForLevel(lv: number) {
  if (!Number.isFinite(lv) || lv < 1 || lv > 10) return '#5b80f5';
  return RDW_PALETTE[10 - lv];
}

type ColoredChunk = { text: string; color?: string };

// 숫자/콜론/물결/공백만 “강화석 표기 가능 문자열”로 간주
function isProbablyCompressedPrice(s: string) {
  return /^[0-9:~\s]+$/.test(s ?? '');
}

function tokenizeCompressedForColor(input: string): ColoredChunk[] {
  const s0 = String(input ?? '').trim().replace(/\s+/g, '');
  if (!s0) return [{ text: '' }];

  let s = s0;
  const out: ColoredChunk[] = [];

  // Case: '10:NN...'
  if (s.startsWith('10:')) {
    const rest = s.slice(3);
    if (/^\d+$/.test(rest)) {
      const use2 = rest.length >= 2 && (rest.length - 2) % 2 === 0;
      const take = use2 ? 2 : 1;
      const nPart = rest.slice(0, take);

      out.push({ text: `10:${nPart}`, color: colorForLevel(10) });
      s = rest.slice(take);
    } else {
      return [{ text: s0 }];
    }
  }

  // Case: '10N...' / '10NN...'
  if (s.startsWith('10')) {
    const rem = s.length - 2;
    if (rem >= 1) {
      const two = rem >= 2 && rem % 2 === 0;
      const take = two ? 2 : 1;
      const nPart = s.slice(2, 2 + take);

      out.push({ text: `10${nPart}`, color: colorForLevel(10) });
      s = s.slice(2 + take);
    } else {
      out.push({ text: '10', color: colorForLevel(10) });
      s = '';
    }
  }

  // 나머지 2자리쌍
  for (let i = 0; i < s.length; ) {
    if (i + 1 >= s.length) {
      out.push({ text: s.slice(i) });
      break;
    }

    const token = s.slice(i, i + 2);
    const lv = parseInt(token[0], 10);

    if (Number.isFinite(lv) && lv >= 1 && lv <= 9) {
      out.push({ text: token, color: colorForLevel(lv) });
    } else {
      out.push({ text: token });
    }

    i += 2;
  }

  return out.length ? out : [{ text: s0 }];
}

function ColoredCompressedText({ value }: { value: string | number }) {
  const raw = String(value ?? '');
  const s = raw.trim();
  if (!s) return <span className="ptc-price-text" />;

  // 범위: 6153~7263
  if (s.includes('~')) {
    const [left, right] = s.split('~', 2);

    const leftChunks = isProbablyCompressedPrice(left)
      ? tokenizeCompressedForColor(left)
      : [{ text: left }];

    const rightChunks = isProbablyCompressedPrice(right)
      ? tokenizeCompressedForColor(right)
      : [{ text: right }];

    return (
      <span className="ptc-price-text">
        <span style={{ whiteSpace: 'nowrap' }}>
          {leftChunks.map((c, i) => (
            <span key={`l-${i}`} style={c.color ? { color: c.color } : undefined}>
              {c.text}
            </span>
          ))}
          <span style={{ color: '#5b80f5' }}>~</span>
        </span>

        <wbr />

        <span style={{ whiteSpace: 'nowrap' }}>
          {rightChunks.map((c, i) => (
            <span key={`r-${i}`} style={c.color ? { color: c.color } : undefined}>
              {c.text}
            </span>
          ))}
        </span>
      </span>
    );
  }

  const chunks = isProbablyCompressedPrice(s) ? tokenizeCompressedForColor(s) : [{ text: s }];

  return (
    <span className="ptc-price-text">
      {chunks.map((c, i) => (
        <span key={i} style={c.color ? { color: c.color } : undefined}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

// -------------------- 선택 모달에서 받는 데이터 타입 --------------------

type PickedPriceItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string;
  prices: string[];
};

// -------------------- ✅ 라이브(최신) 시세 로딩/캐시 --------------------

// 캐시 TTL (원하면 10초/30초/60초로 조절)
const PRICE_CACHE_TTL_MS = 60_000;

// key: "id:123" or "key:xxx"
type CacheEntry = { ts: number; item: PickedPriceItem };

// 모듈 스코프 캐시(페이지 내 공유)
const priceCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PickedPriceItem | null>>();

function makeCacheKey(id?: number | null, nameKey?: string | null) {
  if (Number.isFinite(id as any) && (id as number) > 0) return `id:${id}`;
  const nk = String(nameKey ?? '').trim();
  if (nk) return `key:${nk}`;
  return '';
}

async function fetchLatestPriceItem(id?: number | null, nameKey?: string | null) {
  const key = makeCacheKey(id, nameKey);
  if (!key) return null;

  const now = Date.now();
  const hit = priceCache.get(key);
  if (hit && now - hit.ts <= PRICE_CACHE_TTL_MS) return hit.item;

  const inFlight = inflight.get(key);
  if (inFlight) return inFlight;

  const p = (async () => {
    try {
      const url =
        key.startsWith('id:')
          ? `/api/prices/get?id=${encodeURIComponent(String(id))}`
          : `/api/prices/get?name_key=${encodeURIComponent(String(nameKey ?? ''))}`;

      // 최신 보장 목적: no-store
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
        prices: Array.isArray(it.prices) ? it.prices.map((v: any) => String(v ?? '')) : [],
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

// -------------------- 개별 카드 아이템 --------------------

type PriceCardItemProps = {
  idx: number;
  item: any;
  stageIndex: number;
  hovered: boolean;
  onHover: (hover: boolean) => void;
  editor: Editor;
  path: Path;
  onPrevStage: (len: number) => void;
  onNextStage: (len: number) => void;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

const PriceCardItem: React.FC<PriceCardItemProps> = ({
  idx,
  item,
  stageIndex,
  hovered,
  onHover,
  editor,
  path,
  onPrevStage,
  onNextStage,
  setPriceTableEdit,
}) => {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectModalOpen, setSelectModalOpen] = useState(false);

  const stages: string[] = useMemo(() => {
    return stagesByFormat(item.mode);
  }, [item.mode]);

  const prices: string[] = useMemo(() => {
    const raw = Array.isArray(item.prices) ? item.prices : [];
    const norm = raw.map((v: any) => String(v ?? ''));

    if (norm.length === stages.length) return norm;
    const next = [...norm];
    next.length = stages.length;
    for (let i = 0; i < stages.length; i++) {
      if (typeof next[i] === 'undefined') next[i] = '';
    }
    return next;
  }, [item.prices, stages]);

  const curIdx = stageIndex ?? 0;
  const stage = stages[curIdx] ?? '';
  const priceVal = prices[curIdx] ?? '';
  const badgeColor = getPriceBadgeColor(stage, item.colorType);

  const imgSrc = item.image?.startsWith?.('http') ? toProxyUrl(item.image) : item.image;

  const nameShown = item.name || '이름 없음';

  const { node: nameNode, broke: nameBroke } = useMemo(
    () => smartNameBreakInfo(item.name),
    [item.name]
  );

  const nameFont = useMemo(() => {
    if (!nameBroke) {
      return autoFont(20, String(nameShown), [
        [7, 18],
        [9, 16],
        [12, 14],
        [16, 13],
        [20, 12],
      ]);
    }

    const full = String(item.name ?? '');
    const chars = Array.from(full);
    const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === ' ');

    if (breakAt === -1) return 17;

    const first = chars.slice(0, breakAt).join('');
    const firstLen = Array.from(first).length;
    const firstSpaceCount = (first.match(/\s/g) ?? []).length;

    if (firstLen >= 8 && firstSpaceCount >= 1) return 16;
    return 17;
  }, [nameBroke, nameShown, item.name]);

  const priceFont = autoFont(20, String(priceVal), [
    [8, 20],
    [12, 18],
    [16, 16],
    [22, 14],
    [30, 12],
    [40, 11],
  ]);

  const patchItem = (patch: Record<string, any>) => {
    const el = Editor.node(editor, path)[0] as PriceTableCardElement;
    const newItems = el.items.map((itm, i) => (i === idx ? { ...itm, ...patch } : itm));
    Transforms.setNodes(editor, { items: newItems }, { at: path });
  };

  const handleImageSelect = (url: string) => {
    patchItem({ image: url });
    setImageModalOpen(false);
  };

  const handlePickItem = (picked: PickedPriceItem) => {
    const newStages = stagesByFormat(picked.mode);

    const raw = Array.isArray(picked.prices) ? picked.prices.map((v) => String(v ?? '')) : [];
    const nextPrices = [...raw];
    nextPrices.length = newStages.length;
    for (let i = 0; i < newStages.length; i++) {
      if (typeof nextPrices[i] === 'undefined') nextPrices[i] = '';
    }

    patchItem({
      id: picked.id,
      name: picked.name,
      name_key: picked.name_key,
      mode: picked.mode,
      stages: newStages,
      prices: nextPrices,
    });

    setSelectModalOpen(false);
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 15,
        padding: 8,
        boxShadow: '0 4px 24px 0 rgba(60,60,80,0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minWidth: 140,
        maxWidth: 140,
        minHeight: 160,
        transition: 'box-shadow .15s',
        zIndex: 0,
        margin: '0 8px',
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {stages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            width: 66,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              background: badgeColor,
              color: stage === '봉인' ? '#fff' : '#222',
              padding: '4px 0px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              width: 66,
              display: 'inline-block',
              boxShadow: '0 1px 8px #0001',
              border: '1.5px solid #fff',
              textAlign: 'center',
              letterSpacing: 1,
              transition: 'background .1s',
            }}
          >
            {stage}
          </span>
        </div>
      )}

      {hovered && stages.length > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 단계"
            style={{
              position: 'absolute',
              left: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#fff',
              border: '1.2px solid #eee',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: '0 2px 6px #0001',
              zIndex: 2,
            }}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onPrevStage(stages.length);
            }}
            title="이전"
          >
            ◀
          </button>

          <button
            type="button"
            aria-label="다음 단계"
            style={{
              position: 'absolute',
              right: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#fff',
              border: '1.2px solid #eee',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: '0 2px 6px #0001',
              zIndex: 2,
            }}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onNextStage(stages.length);
            }}
            title="다음"
          >
            ▶
          </button>
        </>
      )}

      {/* 이미지 */}
      <div
        style={{
          marginBottom: 10,
          marginTop: 34,
          cursor: 'pointer',
          width: 65,
          height: 65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setImageModalOpen(true);
        }}
        title="이미지 변경"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            width={65}
            height={65}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            style={{
              width: 65,
              height: 65,
              objectFit: 'contain',
              borderRadius: 7,
              background: '#fff',
              display: 'block',
            }}
            draggable={false}
          />
        ) : (
          <span
            style={{
              width: 54,
              height: 54,
              background: '#ececec',
              borderRadius: 7,
              display: 'inline-block',
            }}
          />
        )}
      </div>

      <ImageSelectModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSelectImage={handleImageSelect}
      />

      {/* 이름 (클릭하면 아이템 선택 모달) */}
      <div
        style={{
          fontWeight: 700,
          fontSize: nameFont,
          lineHeight: 1.12,
          marginBottom: 0,
          color: item.name ? '#333' : '#bbb',
          textAlign: 'center',
          minHeight: 40,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          whiteSpace: 'normal',
        }}
        title="아이템 선택"
        onClick={(e) => {
          e.stopPropagation();
          try {
            Transforms.deselect(editor);
          } catch {}
          setSelectModalOpen(true);
        }}
      >
        {item.name ? nameNode : <span style={{ color: '#bbb' }}>이름 없음</span>}
      </div>

      <PriceItemSelectModal
        open={selectModalOpen}
        onClose={() => setSelectModalOpen(false)}
        onSelect={handlePickItem}
      />

      {/* 가격 (클릭하면 PriceTableEditModal 흐름 유지) */}
      <div
        style={{
          fontWeight: 800,
          fontSize: priceFont,
          lineHeight: 1.04,
          color: '#5b80f5',
          textAlign: 'center',
          letterSpacing: 1,
          marginTop: 3,
          cursor: 'pointer',
          borderRadius: 8,
          padding: '2px 10px',
          minHeight: 28,
        }}
        title="가격 수정"
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('editor:capture-scroll:price'));
          setPriceTableEdit({
            blockPath: path,
            idx,
            item: { ...item, mode: item.mode ?? 'block' },
          });
        }}
      >
        <ColoredCompressedText value={priceVal} />
      </div>
    </div>
  );
};

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

  // Backspace로 블럭 자체 삭제 방지
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

  const [stageIdxArr, setStageIdxArr] = useState<number[]>(el.items.map(() => 0));
  const [hovered, setHovered] = useState<number | null>(null);

  // ✅ 라이브 시세 반영된 "표시용 items"
  const [liveMap, setLiveMap] = useState<Map<string, PickedPriceItem>>(new Map());

  // 아이템 변경되면 stage index 초기화
  useEffect(() => {
    setStageIdxArr(el.items.map(() => 0));
  }, [el.items]);

  // ✅ 이 카드에 포함된 아이템들의 identity 시그니처 (id/name_key 기반)
  const itemsSignature = useMemo(() => {
    return (el.items ?? [])
      .map((it: any) => makeCacheKey(it?.id ?? null, it?.name_key ?? null))
      .filter(Boolean)
      .join('|');
  }, [el.items]);

  // ✅ 렌더링 시점(= mount + itemsSignature 변화 시점)에 최신 시세를 가져와서 표시용으로만 덮어씀
  useEffect(() => {
    let alive = true;

    (async () => {
      const items = Array.isArray(el.items) ? el.items : [];
      const targets = items
        .map((it: any) => {
          const key = makeCacheKey(it?.id ?? null, it?.name_key ?? null);
          return { key, id: it?.id ?? null, name_key: it?.name_key ?? null };
        })
        .filter((t) => !!t.key);

      if (targets.length === 0) {
        if (alive) setLiveMap(new Map());
        return;
      }

      const results = await Promise.all(
        targets.map(async (t) => {
          const latest = await fetchLatestPriceItem(t.id, t.name_key);
          return { key: t.key, latest };
        })
      );

      if (!alive) return;

      const next = new Map<string, PickedPriceItem>();
      for (const r of results) {
        if (r.latest) next.set(r.key, r.latest);
      }
      setLiveMap(next);
    })();

    return () => {
      alive = false;
    };
  }, [itemsSignature, el.items]);

  // ✅ "표시용" 최종 items: 문서에 저장된 item + (라이브 시세) 병합
  // - image 같은 사용자 커스텀 값은 문서에 저장된 값을 유지
  // - name/mode/prices는 최신 값을 우선 반영
  const viewItems = useMemo(() => {
    const items = Array.isArray(el.items) ? el.items : [];
    return items.map((it: any) => {
      const key = makeCacheKey(it?.id ?? null, it?.name_key ?? null);
      const latest = key ? liveMap.get(key) : null;

      if (!latest) return it;

      const newStages = stagesByFormat(latest.mode);
      const raw = Array.isArray(latest.prices) ? latest.prices.map((v) => String(v ?? '')) : [];
      const nextPrices = [...raw];
      nextPrices.length = newStages.length;
      for (let i = 0; i < newStages.length; i++) {
        if (typeof nextPrices[i] === 'undefined') nextPrices[i] = '';
      }

      return {
        ...it,
        id: latest.id ?? it.id,
        name: latest.name ?? it.name,
        name_key: latest.name_key ?? it.name_key,
        mode: latest.mode ?? it.mode,
        stages: newStages,
        prices: nextPrices,
      };
    });
  }, [el.items, liveMap]);

  const handlePrev = (idx: number, len: number) => {
    setStageIdxArr((arr) => arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)));
  };
  const handleNext = (idx: number, len: number) => {
    setStageIdxArr((arr) => arr.map((v, i) => (i === idx ? (v + 1) % len : v)));
  };

  return (
    <div {...attributes}>
      <div
        contentEditable={false}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0,
          boxSizing: 'border-box',
          padding: '10px 0',
          margin: '10px 0',
          marginLeft: 10,
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="시세표 블럭 삭제"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 10,
            background: '#fff',
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
            boxShadow: '0 1px 8px #0001',
            cursor: 'pointer',
            transition: 'background .13s',
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 25,
            flexWrap: 'nowrap',
            width: '100%',
            justifyContent: 'center',
            margin: '0 auto',
            maxWidth: 1040,
          }}
        >
          {viewItems.map((item, idx) => {
            const stages = stagesByFormat(item?.mode);
            return (
              <PriceCardItem
                key={idx}
                idx={idx}
                item={item}
                stageIndex={stageIdxArr[idx] ?? 0}
                hovered={hovered === idx}
                onHover={(h) => setHovered(h ? idx : null)}
                editor={editorStatic}
                path={path}
                onPrevStage={(len) => handlePrev(idx, len)}
                onNextStage={(len) => handleNext(idx, len)}
                setPriceTableEdit={setPriceTableEdit}
              />
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}

export default PriceTableCard;