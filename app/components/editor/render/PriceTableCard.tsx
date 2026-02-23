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

/**
 * ✅ 이름 줄바꿈 규칙 + "줄바꿈 발생 여부"까지 반환
 * - 10글자 이상 + 띄어쓰기 2개 이상이면
 * - 7글자 이후에 처음 등장하는 띄어쓰기 지점부터 줄바꿈
 *   (해당 공백은 제거하고 다음 줄로 보냄)
 */
function smartNameBreakInfo(nameRaw: string | null | undefined) {
  const name = String(nameRaw ?? '');
  const chars = Array.from(name);
  const len = chars.length;
  const spaceCount = chars.reduce((acc, ch) => (ch === ' ' ? acc + 1 : acc), 0);

  if (len < 10 || spaceCount < 2) {
    return { node: name as React.ReactNode, broke: false };
  }

  // "7글자 다음 띄어쓰기" → 인덱스 7(=8번째 글자 위치)부터 공백 탐색
  const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === ' ');
  if (breakAt === -1) {
    return { node: name as React.ReactNode, broke: false };
  }

  const first = chars.slice(0, breakAt).join('');
  const second = chars.slice(breakAt + 1).join(''); // 공백 제거

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

/** 가격 텍스트: "~" 있을 때만 줄바꿈 힌트 */

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

/**
 * 렌독 강화석 축약 표기 “표시용 토큰화”
 * - 10:NN... / 10N... / 10NN... 지원
 * - 나머지: 2자리쌍(lv + ct) 토큰
 * - 토큰 전체를 해당 lv 색으로 칠함
 */
function tokenizeCompressedForColor(input: string): ColoredChunk[] {
  const s0 = String(input ?? '').trim().replace(/\s+/g, '');
  if (!s0) return [{ text: '' }];

  let s = s0;
  const out: ColoredChunk[] = [];

  // Case: '10:NN...' → 표시 토큰: '10:NN' (10강 색)
  if (s.startsWith('10:')) {
    const rest = s.slice(3);
    if (/^\d+$/.test(rest)) {
      // parseCompressed와 동일한 추론:
      // 가능한 한 10강을 2자리로 우선 해석 (뒤 2자리쌍 정렬을 위해)
      const use2 = rest.length >= 2 && (rest.length - 2) % 2 === 0;
      const take = use2 ? 2 : 1;
      const nPart = rest.slice(0, take);

      out.push({ text: `10:${nPart}`, color: colorForLevel(10) });
      s = rest.slice(take);
    } else {
      return [{ text: s0 }];
    }
  }

  // Case: '10N...' / '10NN...' → 표시 토큰: '10N' or '10NN' (10강 색)
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

  // 나머지 2자리쌍: 예) 61 52 ...
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

  // 단일: 6152 / 10183 / 10:129312 ...
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

  // ✅ 줄바꿈 가공(표시용) + 줄바꿈 발생 여부
  const { node: nameNode, broke: nameBroke } = useMemo(
    () => smartNameBreakInfo(item.name),
    [item.name]
  );

  // ✅ 줄바꿈이 발생하면 무조건 17pt
  const nameFont = nameBroke
    ? 17
    : autoFont(20, String(nameShown), [
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
          minHeight: 40, // ✅ 2줄 가능하니 여유
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          whiteSpace: 'normal', // ✅ 줄바꿈 허용
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
            // ✅ 이제 stages는 mode로 결정되므로 item에 mode만 확실히 전달
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