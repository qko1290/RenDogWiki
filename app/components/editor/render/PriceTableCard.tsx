// =============================================
// File: components/editor/render/PriceTableCard.tsx  (전체 코드)
// =============================================
import React, { useEffect, useState } from 'react';
import { ReactEditor, useSlateStatic } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { Editor, Element as SlateElement, Path, Transforms } from 'slate';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';
import type { PriceTableCardElement } from '@/types/slate';
import type { PriceTableEditState } from './types';

// -------------------- mode → stages(라벨) --------------------

const AWAKENING_FIELDS = ['봉인', '1각', '2각', '3각', '4각', 'MAX'] as const;
const TRANSCEND_FIELDS = ['거가', '거불'] as const;
const SINGLE_FIELDS = ['가격'] as const;

/**
 * ✅ DB/프론트 공통 표준 mode
 * - 단일: block, cash, limited, box, armor, boss, monster, title, costume, fishing, scroll, rune
 * - 각성: epic, unique, legendary, divine, superior
 * - 초월: transcend_epic, transcend_unique, transcend_legendary, transcend_divine, transcend_superior
 */
const SINGLE_PRICE_MODES = new Set([
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
]);

const AWAKENING_MODES = new Set(['epic', 'unique', 'legendary', 'divine', 'superior']);

const TRANSCEND_MODES = new Set([
  'transcend_epic',
  'transcend_unique',
  'transcend_legendary',
  'transcend_divine',
  'transcend_superior',
]);

function normalizeMode(mode: any): string {
  return String(mode ?? '').trim().toLowerCase();
}

function getStagesByMode(mode: any): string[] {
  const m = normalizeMode(mode);

  if (AWAKENING_MODES.has(m)) return [...AWAKENING_FIELDS];
  if (TRANSCEND_MODES.has(m)) return [...TRANSCEND_FIELDS];
  if (SINGLE_PRICE_MODES.has(m)) return [...SINGLE_FIELDS];

  // 알 수 없는 mode면 안전하게 단일로 처리
  return [...SINGLE_FIELDS];
}

/** mode 라벨 길이에 맞춰 prices 배열 길이 보정 */
function normalizePricesByStages(
  prices: any,
  stagesLen: number,
): Array<string | number> {
  const base = Array.isArray(prices) ? prices : [];
  const out = new Array(stagesLen).fill('');
  for (let i = 0; i < stagesLen; i++) out[i] = base[i] ?? '';
  return out;
}

// -------------------- 유틸 --------------------

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

/** 가격 텍스트: 필요시에만 줄바꿈 */
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
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(item.name || '');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // ✅ stages는 이제 item.mode로 결정
  const stages: string[] = getStagesByMode(item?.mode);
  const prices: Array<string | number> = normalizePricesByStages(item?.prices, stages.length);

  const curIdx = stageIndex ?? 0;
  const stage = stages[curIdx] ?? '';
  const priceVal = prices[curIdx] ?? '';
  const badgeColor = getPriceBadgeColor(stage, item.colorType);

  const imgSrc =
    item.image?.startsWith?.('http') ? toProxyUrl(item.image) : item.image;

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

  const handleImageSelect = (url: string) => {
    const el = Editor.node(editor, path)[0] as PriceTableCardElement;
    const newItems = el.items.map((itm, i) =>
      i === idx ? { ...itm, image: url } : itm,
    );
    Transforms.setNodes(editor, { items: newItems }, { at: path });
    setImageModalOpen(false);
  };

  const handleNameSave = () => {
    const el = Editor.node(editor, path)[0] as PriceTableCardElement;
    const newItems = el.items.map((itm, i) =>
      i === idx ? { ...itm, name: editNameValue } : itm,
    );
    Transforms.setNodes(editor, { items: newItems }, { at: path });
    setEditingName(false);
  };

  const showStageBadge = stages.length > 1; // ✅ 단일가격은 배지/좌우 넘김 의미 없음

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
      {showStageBadge && (
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

      {hovered && showStageBadge && (
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

      <div
        style={{
          marginBottom: 10,
          marginTop: showStageBadge ? 34 : 18,
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

      {/* 이름 */}
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
        }}
      >
        {editingName ? (
          <input
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave();
              if (e.key === 'Escape') setEditingName(false);
            }}
            onFocus={() => {
              try {
                Transforms.deselect(editor);
              } catch {
                /* ignore */
              }
            }}
            style={{
              fontSize: nameFont,
              fontWeight: 700,
              color: '#333',
              textAlign: 'center',
              border: '1.5px solid #b4cafe',
              borderRadius: 6,
              padding: '2px 6px',
              outline: 'none',
              width: '80%',
            }}
          />
        ) : (
          <span
            style={{ cursor: 'pointer', width: '100%' }}
            onClick={(e) => {
              e.stopPropagation();
              setEditNameValue(item.name || '');
              setEditingName(true);
              try {
                Transforms.deselect(editor);
              } catch {
                /* ignore */
              }
            }}
            title="이름 수정"
          >
            {item.name || <span style={{ color: '#bbb' }}>이름 없음</span>}
          </span>
        )}
      </div>

      {/* 가격 */}
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

          // ✅ 이제 item.mode 기반으로 편집 모달에서 stages를 결정하도록 전달
          setPriceTableEdit({
            blockPath: path,
            idx,
            item: {
              ...item,
              mode: normalizeMode(item?.mode) || 'block',
              // stages는 더 이상 저장/전달하지 않음(프론트에서 mode로 계산)
            },
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

  useEffect(() => {
    // items가 바뀌면 각 카드의 stageIndex 초기화
    setStageIdxArr(el.items.map(() => 0));
  }, [el.items]);

  const handlePrev = (idx: number, len: number) => {
    setStageIdxArr((arr) =>
      arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)),
    );
  };

  const handleNext = (idx: number, len: number) => {
    setStageIdxArr((arr) =>
      arr.map((v, i) => (i === idx ? (v + 1) % len : v)),
    );
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
            const stages = getStagesByMode(item?.mode);
            const len = stages.length;

            return (
              <PriceCardItem
                key={idx}
                idx={idx}
                item={item}
                stageIndex={Math.max(0, Math.min(stageIdxArr[idx] ?? 0, len - 1))}
                hovered={hovered === idx}
                onHover={(h) => setHovered(h ? idx : null)}
                editor={editorStatic}
                path={path}
                onPrevStage={() => handlePrev(idx, len)}
                onNextStage={() => handleNext(idx, len)}
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