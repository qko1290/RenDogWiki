// =============================================
// File: components/editor/render/PriceTableCard.tsx  (전체 코드)
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
// (경로는 너 프로젝트 구조에 맞춰 조정)
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
  // default: 단일 가격
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

// 길이에 따라 글자 크기 자동 축소
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

/** 가격 텍스트: "~" 있을 때만 줄바꿈 힌트 */
function PriceText({ value }: { value: string | number }) {
  const s = String(value ?? '');
  if (!s.includes('~')) return <span className="ptc-price-text">{s}</span>;
  const [left, right] = s.split('~', 2);
  return (
    <span className="ptc-price-text">
      <span style={{ whiteSpace: 'nowrap' }}>{left}~</span>
      <wbr />
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </span>
  );
}

// -------------------- 선택 모달에서 받는 데이터 타입(가정) --------------------
// 네 모달 구현에 맞춰 필드명/타입 조정 가능
type PickedPriceItem = {
  id: number;
  name: string;
  name_key: string;
  mode: string; // = 위 PriceFormat 중 하나
  prices: string[]; // "~" 포함 가능
};

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

  // ✅ 이름 클릭 → 선택 모달
  const [selectModalOpen, setSelectModalOpen] = useState(false);

  const stages: string[] = useMemo(() => {
    // item.stages가 남아있더라도, 이제는 "형식(mode)" 기준으로 프론트에서 스테이지를 결정
    return stagesByFormat(item.mode);
  }, [item.mode]);

  const prices: string[] = useMemo(() => {
    const raw = Array.isArray(item.prices) ? item.prices : [];
    const norm = raw.map((v: any) => String(v ?? ''));

    // 스테이지 길이에 맞게 보정
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
  const nameFont = autoFont(20, String(nameShown), [
    [7, 18],
    [9, 16],
    [12, 14],
    [16, 13],
    [20, 12],
  ]);

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

    // prices 길이도 스테이지에 맞게 보정
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
      // ✅ 이제 stages는 저장해도 되고 안 해도 되지만,
      // 기존 호환/디버깅 편하게 넣어두자(프론트 기준은 mode)
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

      {/* ✅ 이름 (클릭하면 "편집 모달" 대신 "아이템 선택 모달") */}
      <div
        style={{
          fontWeight: 700,
          fontSize: nameFont,
          lineHeight: 1.12,
          marginBottom: 0,
          color: item.name ? '#333' : '#bbb',
          textAlign: 'center',
          minHeight: 24,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
        }}
        title="아이템 선택"
        onClick={(e) => {
          e.stopPropagation();
          // Slate selection 꼬임 방지
          try {
            Transforms.deselect(editor);
          } catch {}
          setSelectModalOpen(true);
        }}
      >
        {item.name || <span style={{ color: '#bbb' }}>이름 없음</span>}
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
            // ✅ 이제 stages는 mode로 결정되므로 item에 mode만 확실히 전달
            item: { ...item, mode: item.mode ?? 'block' },
          });
        }}
      >
        <PriceText value={priceVal} />
      </div>
    </div>
  );
};

// -------------------- 메인 렌더러 --------------------

// Element.tsx 에서 넘겨주는 실제 props 모양
export interface PriceTableCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: PriceTableCardElement;
  editor: any; // 지금은 사용 안 하지만 Element.tsx에서 넘기므로 허용
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

  // 아이템 변경되면 stage index 초기화
  useEffect(() => {
    setStageIdxArr(el.items.map(() => 0));
  }, [el.items]);

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
          {el.items.map((item, idx) => {
            // ✅ mode 기반으로 len 계산(hover 화살표가 정확히 동작)
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