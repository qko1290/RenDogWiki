'use client';

/**
 * Slate 에디터에서 커스텀 블록(heading, 링크, info-box, divider, paragraph, 시세카드 등)을 렌더링하는 컴포넌트
 * - heading: 아이콘 클릭, id 생성, 정렬 지원
 * - link/link-block: 인라인/카드형 하이퍼링크
 * - info-box: 참고/주의/경고 박스 렌더링
 * - divider: 다양한 구분선
 * - paragraph: 기본 단락, 인덴트 라인 지원
 * - price-table-card: 아이템별 가격, 각성/초월 등 상태 뱃지·이름/이미지/가격 인라인 편집 지원
 */

import React, { useState, useEffect } from 'react';
import { RenderElementProps, ReactEditor, useSelected, useFocused, useSlate, useSlateStatic } from 'slate-react';
import { Node, Transforms, Path, Editor, Element as SlateElement } from 'slate';
import { getHeadingId } from './helpers/getHeadingId';
import ImageSizeModal from './ImageSizeModal';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import type { InlineMarkElement, InlineImageElement, PriceTableCardElement, CustomElement, LinkElement, LinkBlockElement, InfoBoxElement, HeadingOneElement, HeadingTwoElement, HeadingThreeElement, ImageElement, ParagraphElement } from '@/types/slate';

type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

type ElementProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

function InfoPhotoIcon({ tone }: { tone: 'note' | 'tip' | 'warn' | 'danger' }) {
  const color =
    tone === 'danger' ? '#ef4444' :
    tone === 'warn'   ? '#f59e0b' :
    tone === 'tip'    ? '#10b981' :
                        '#2563eb' ;

  // 각 톤별 아이콘(사진 느낌의 심볼)
  // - danger  : 삼각 경고
  // - warn    : 둥근 느낌표
  // - note    : 둥근 i
  // - tip     : 전구
  if (tone === 'danger') {
    return (
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
        <defs>
          <linearGradient id="g-danger" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff8a8a" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <path
          d="M22.5 7.5 4.8 38.2c-.9 1.6.2 3.6 2 3.6h34.4c1.8 0 2.9-2 2-3.6L25.5 7.5a2.3 2.3 0 0 0-3 0Z"
          fill="url(#g-danger)"
          stroke={color}
          strokeWidth="1"
        />
        <rect x="22" y="17" width="4" height="14" rx="2" fill="#fff"/>
        <circle cx="24" cy="36" r="2" fill="#fff"/>
      </svg>
    );
  }
  if (tone === 'warn') {
    return (
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
        <defs>
          <linearGradient id="g-warn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd899" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill="url(#g-warn)" stroke={color} strokeWidth="1"/>
        <rect x="22.5" y="13" width="3" height="16" rx="1.5" fill="#fff"/>
        <circle cx="24" cy="33" r="2" fill="#fff"/>
      </svg>
    );
  }
  if (tone === 'tip') {
    return (
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
        <defs>
          <linearGradient id="g-tip" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#78ffd6" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <path d="M24 6c7 0 12 5.3 12 11.7 0 4-2 7.2-5 9.3-1.2.9-1.9 2.3-2 3.8v.6h-10v-.6c0-1.5-.8-2.9-2-3.8-3-2.1-5-5.4-5-9.3C12 11.3 17 6 24 6Z" fill="url(#g-tip)"/>
        <rect x="18" y="33" width="12" height="3.5" rx="1.8" fill="#0b6b52" opacity=".15"/>
        <rect x="20" y="37" width="8" height="4" rx="2" fill="#0b6b52" opacity=".25"/>
      </svg>
    );
  }
  // note (info)
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <defs>
        <linearGradient id="g-note" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bcd3ff" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#g-note)" stroke={color} strokeWidth="1"/>
      <circle cx="24" cy="15" r="2.6" fill="#fff"/>
      <rect x="22.4" y="19" width="3.2" height="14" rx="1.6" fill="#fff"/>
    </svg>
  );
}

/**
 * 각 상태(각성, 초월, MAX 등)에 맞는 뱃지 배경색 반환
 */
function getPriceBadgeColor(stage: string, type?: string) {
  switch (stage) {
    case '봉인':   return '#444';
    case '1각':
    case '2각':
    case '3각':
    case '4각':    return '#48ea6d';
    case 'MAX':    return '#ffe360';
    case '거가':   return '#43b04b';
    case '거불':   return '#e44c4c';
    default:       return '#5cacee';
  }
}

/**
 * 가격 테이블 아이템이 각성/초월/일반 중 어떤 타입인지 유추
 */
function guessPriceMode(item: any): 'normal' | 'awakening' | 'transcend' {
  if (!item.stages) return 'normal';
  const set = new Set(item.stages);
  if (item.stages.length === 6 && set.has('봉인') && set.has('MAX')) return 'awakening';
  if (item.stages.includes('거가') && item.stages.includes('거불')) return 'transcend';
  return 'normal';
}

const Element: React.FC<ElementProps> = ({
  attributes, children, element, editor, onIconClick, priceTableEdit, setPriceTableEdit,
}) => {
  // 카드형 가격테이블의 각 아이템에 hover 효과 주기 위해 인덱스 관리
  const [hovered, setHovered] = useState<number | null>(null);

  switch (element.type) {
    // 인라인 링크
    case 'link': {
      return (
        <a {...attributes} href={element.url} style={{ color: '#2676ff' }}>
          {children}
        </a>
      );
    }

    // 카드형 링크 블록
    case 'link-block': {
      const el = element as LinkBlockElement;
      const isReadOnly = ReactEditor.isReadOnly(editor);

      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 6,
            marginBottom: 8,
            width: el.size === 'small' ? '48%' : '100%',
          }}
        >
          {/* 삭제 버튼(읽기 전용이 아닐 때만) */}
          {!isReadOnly && (
            <button
              contentEditable={false}
              onClick={() => {
                const path = ReactEditor.findPath(editor, element);
                Transforms.removeNodes(editor, { at: path });
              }}
              style={{
                position: 'absolute', top: 4, right: 6,
                border: '1px solid #ccc', background: '#f8f8f8',
                color: '#555', borderRadius: '50%',
                width: 20, height: 20, fontSize: 13, fontWeight: 'bold',
                lineHeight: '20px', textAlign: 'center',
                padding: 0, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e0e0e0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f8f8f8')}
            >×</button>
          )}
          {/* 파비콘 */}
          {el.favicon && (
            <img src={el.favicon} alt="favicon" style={{ width: 24, height: 24, marginRight: 8 }} />
          )}
          {/* 사이트명/URL */}
          <a
            href={el.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0070f3',
              textDecoration: 'none',
              flexGrow: 1,
            }}
          >
            {el.sitename || el.url}
          </a>
        </div>
      );
    }

    // Heading(h1, h2, h3)
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');

      return (
        <Tag
          {...attributes}
          id={getHeadingId(el)}
          style={{ fontSize, textAlign: el.textAlign || 'left', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {/* 아이콘 클릭 시 아이콘 수정 모달 오픈 */}
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{ cursor: 'pointer', marginRight: 8, display: 'inline-flex', alignItems: 'center' }}
          >
            {el.icon?.startsWith('http')
              ? <img src={el.icon} alt="icon" style={{ width: '1.7em', height: '1.7em', verticalAlign: 'middle', marginRight: 6, objectFit: 'contain' }} />
              : <span style={{ fontSize: '1.5em', marginRight: 6 }}>{el.icon || (level === 1 ? '📌' : level === 2 ? '🔖' : '📝')}</span>
            }
          </span>
          <span style={{ display: 'inline' }}>{children}</span>
        </Tag>
      );
    }

    // Divider(구분선)
    case 'divider': {
      const style = element.style || "default";
      const borderColor = "#e0e0e0";
      switch (style) {
        case "bold":
          return (
            <div {...attributes} style={{ width: '70%', margin: "32px auto", textAlign: 'center' }}>
              <hr style={{ border: 0, borderTop: `4px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "shortbold":
          return (
            <div {...attributes} style={{ width: 82, margin: "34px auto", textAlign: 'center' }}>
              <hr style={{ border: 0, borderTop: `5px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "dotted":
          return (
            <div {...attributes} style={{ width: '70%', margin: "28px auto", textAlign: 'center' }}>
              <hr style={{ border: 0, borderTop: `2px dotted ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "diamond":
          return (
            <div {...attributes} style={{ textAlign: 'center', margin: "14px 0" }}>
              <span style={{ fontSize: 24, letterSpacing: 12, color: borderColor }}>◇───◇</span>
            </div>
          );
        case "diamonddot":
          return (
            <div {...attributes} style={{ textAlign: 'center', margin: "14px 0" }}>
              <span style={{ fontSize: 22, letterSpacing: 6, color: borderColor }}>◇ ⋅ ⋅ ⋅ ◇</span>
            </div>
          );
        case "dotdot":
          return (
            <div {...attributes} style={{ width: '100%', margin: "30px 0", textAlign: 'center' }}>
              <span style={{ fontSize: 28, letterSpacing: 8, color: borderColor }}>• • • • • • •</span>
            </div>
          );
        case "slash":
          return (
            <div {...attributes} style={{ width: '100%', margin: "30px 0", textAlign: 'center' }}>
              <span style={{ fontSize: 30, letterSpacing: 14, color: borderColor }}>/  /  /</span>
            </div>
          );
        case "bar":
          return (
            <div {...attributes} style={{ width: '100%', margin: "28px 0", textAlign: 'center' }}>
              <span style={{ fontSize: 22, color: borderColor }}>|</span>
            </div>
          );
        default:
          return (
            <div {...attributes} style={{ width: '70%', margin: "24px auto", textAlign: 'center' }}>
              <hr style={{ border: 0, borderTop: `1.5px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
      }
    }

    // 기본 단락(문단)
    case 'paragraph': {
      const el = element as ParagraphElement;
      const indentLine = (el as any).indentLine;

      // 연속된 indentLine 단락 구분을 위한 class 추가
      let extraClass = "";
      if (indentLine) {
        const slateEditor = useSlate();
        const path = ReactEditor.findPath(slateEditor, element);
        let isFirst = true, isLast = true;
        try {
          const prevPath = Path.previous(path);
          const prevNode = Node.get(slateEditor, prevPath) as any;
          if (prevNode && prevNode.indentLine) isFirst = false;
        } catch {}
        try {
          const nextPath = Path.next(path);
          const nextNode = Node.get(slateEditor, nextPath) as any;
          if (nextNode && nextNode.indentLine) isLast = false;
        } catch {}
        if (isFirst) extraClass += " start";
        if (isLast) extraClass += " end";
      }

      return (
        <p
          {...attributes}
          style={{
            textAlign: el.textAlign || 'left',
            borderLeft: indentLine ? '4px solid #aaa' : undefined,
            paddingLeft: indentLine ? 16 : undefined,
            margin: 0,
          }}
          className={indentLine ? `slate-indent-line${extraClass}` : undefined}
        >
          {children}
        </p>
      );
    }

    // 정보 박스(info/warning/danger)
    case 'info-box': {
      // 툴바/데이터에 저장된 키 이름들이 프로젝트마다 달라서 폭넓게 수용
      const raw =
        (element as any).boxType ||
        (element as any).variant ||
        (element as any).tone ||
        (element as any).infoType ||
        'note';

      const tone: 'note' | 'warn' | 'danger' | 'tip' =
        raw === 'danger' || raw === 'error' ? 'danger' :
        raw === 'warn'   || raw === 'warning' ? 'warn' :
        raw === 'tip'    || raw === 'success' ? 'tip'  :
                          'note';

      return (
        <div {...attributes} className={`infobox infobox--${tone}`}>
          {/* 아이콘은 CSS ::before에서 mask-image로 채움 */}
          <span className="infobox__icon" aria-hidden="true" contentEditable={false} />
          <div className="infobox__body">{children}</div>
        </div>
      );
    }

    // 본문 내 삽입 이미지
    case 'image': {
      const el = element as any;
      const selected = useSelected();
      const focused = useFocused();
      const [modalOpen, setModalOpen] = useState(false);

      // 이미지 크기 편집 아이콘
      const EditIcon = ({ size = 18, color = "#2a90ff" }) => (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <path d="M3 17h3.8a1 1 0 0 0 .7-.3l8.4-8.4a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L3.3 12.2a1 1 0 0 0-.3.7V17z" stroke={color} strokeWidth="1.7"/>
          <path d="M11.7 6.3l2.5 2.5" stroke={color} strokeWidth="1.7"/>
        </svg>
      );

      let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (el.textAlign === 'left') justifyContent = 'flex-start';
      else if (el.textAlign === 'right') justifyContent = 'flex-end';

      const handleClick = (e: React.MouseEvent) => {
        if (!(selected && focused)) {
          e.preventDefault();
          const path = ReactEditor.findPath(editor, element);
          Transforms.select(editor, path);
          ReactEditor.focus(editor);
        }
      };

      const handleEditBadgeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setModalOpen(true);
      };

      const handleSaveSize = (width: number, height: number) => {
        const path = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { width, height }, { at: path });
        setModalOpen(false);
      };

      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            margin: "16px 0",
            display: "flex",
            flexDirection: "row",
            justifyContent,
            alignItems: "flex-start",
            minHeight: 40,
          }}
          onClick={handleClick}
        >
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={el.url}
              alt=""
              style={{
                maxWidth: el.width ? el.width + "px" : "90%",
                height: el.height ? el.height + "px" : "auto",
                borderRadius: 10,
                boxShadow: "0 2px 12px 0 #0001",
                background: "#fff",
                display: "block",
                border: (selected && focused) ? "2px solid #2a90ff" : "none",
                transition: "border 0.1s",
              }}
            />
            {(selected && focused) && (
              <button
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "#fff",
                  border: "1.5px solid #2a90ff",
                  borderRadius: "50%",
                  boxShadow: "0 1px 5px #0001",
                  width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 1,
                  padding: 0,
                }}
                tabIndex={-1}
                onClick={handleEditBadgeClick}
                title="이미지 크기 편집"
              >
                <EditIcon size={18} color="#2a90ff" />
              </button>
            )}
          </div>
          {children}
          <ImageSizeModal
            open={modalOpen}
            width={el.width}
            height={el.height}
            onSave={handleSaveSize}
            onClose={() => setModalOpen(false)}
          />
        </div>
      );
    }

    // 인라인 이미지
    case 'inline-image' : {
      const el = element as InlineImageElement;
      return (
        <span {...attributes} contentEditable={false} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <img
            src={el.url}
            alt=""
            style={{
              height: '3em',
              width: 'auto',
              display: 'inline',
              verticalAlign: 'middle',
              margin: '0 2px',
              borderRadius: 4,
            }}
          />
          {children}
        </span>
      );
    }

    // 인라인 마크(강조 텍스트)
    case 'inline-mark': {
      const el = element as InlineMarkElement;
      return (
        <span
          {...attributes}
          contentEditable={false}
          style={{
            display: 'inline-block',
            fontWeight: 'bold',
            color: el.color || '#888',
            fontSize: '1.08em',
            marginRight: 8,
            marginLeft: 2,
            userSelect: 'none',
            verticalAlign: 'middle',
          }}
          className="inline-mark"
        >
          {el.icon}
          {children}
        </span>
      );
    }

    // 가격표 카드 블럭 (아이템 가격·이미지·이름 인라인 편집, 단계별 가격 전환)
    case 'price-table-card': {
      const el = element as PriceTableCardElement;
      const editor = useSlateStatic();
      const path = ReactEditor.findPath(editor, el);

      // 가격표 블럭 내에서 Backspace 방지(전체 삭제 방지)
      useEffect(() => {
        const handler = (e: KeyboardEvent) => {
          const { selection } = editor;
          if (!selection || !ReactEditor.isFocused(editor)) return;
          const [node] = Editor.node(editor, selection, { depth: 1 });
          if (SlateElement.isElement(node) && node.type === 'price-table-card' && e.key === 'Backspace') {
            e.preventDefault();
          }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
      }, [editor]);

      // 단계별 인덱스 관리
      const [stageIdxArr, setStageIdxArr] = useState(el.items.map(() => 0));
      useEffect(() => { setStageIdxArr(el.items.map(() => 0)); }, [el.items]);

      const handlePrev = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)));
      };
      const handleNext = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v + 1) % len : v)));
      };

      return (
        <div
          {...attributes}
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
          {/* 카드 전체 삭제 */}
          <button
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 10,
              background: '#fff',
              color: '#d34b4b',
              border: '1.2px solid #e6b7b7',
              borderRadius: '50%',
              width: 26, height: 26,
              fontWeight: 900,
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 8px #0001',
              cursor: 'pointer',
              transition: 'background 0.13s',
            }}
            title="시세표 블럭 삭제"
            tabIndex={-1}
            onClick={e => {
              e.stopPropagation();
              const path = ReactEditor.findPath(editor, element);
              Transforms.removeNodes(editor, { at: path });
            }}
          >×</button>

          {/* 가격카드(여러개 지원) */}
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
              const stages = item.stages || ['가격'];
              const prices = item.prices || [0];
              const curIdx = stageIdxArr[idx] ?? 0;
              const stage = stages[curIdx] ?? '';
              const price = prices[curIdx] ?? 0;
              const badgeColor = getPriceBadgeColor(stage, item.colorType);

              // 이름/이미지/가격 인라인 편집 상태
              const [editingName, setEditingName] = useState(false);
              const [editNameValue, setEditNameValue] = useState(item.name || '');
              const [imageModalOpen, setImageModalOpen] = useState(false);

              const handleImageSelect = (url: string) => {
                const newItems = el.items.map((itm, i) =>
                  i === idx ? { ...itm, image: url } : itm
                );
                Transforms.setNodes(editor, { items: newItems }, { at: path });
                setImageModalOpen(false);
              };

              const handleNameSave = () => {
                const newItems = el.items.map((itm, i) =>
                  i === idx ? { ...itm, name: editNameValue } : itm
                );
                Transforms.setNodes(editor, { items: newItems }, { at: path });
                setEditingName(false);
              };

              return (
                <div
                  key={idx}
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
                    margin: '0 8px'
                  }}
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* 단계 뱃지 */}
                  {stages.length > 1 && (
                    <div style={{
                      position: 'absolute', top: 5, left: '50%',
                      transform: 'translateX(-50%)', zIndex: 3, width: 66,
                      display: 'flex', justifyContent: 'center'
                    }}>
                      <span style={{
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
                        transition: 'background .1s'
                      }}>
                        {stage}
                      </span>
                    </div>
                  )}

                  {/* 단계 전환(좌/우 화살표) */}
                  {hovered === idx && (
                    <>
                      <button
                        style={{
                          position: 'absolute', left: -12, top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#fff', border: '1.2px solid #eee',
                          borderRadius: '50%', width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontWeight: 800, fontSize: 16,
                          boxShadow: '0 2px 6px #0001', zIndex: 2
                        }}
                        tabIndex={-1}
                        onClick={e => { e.stopPropagation(); handlePrev(idx, stages.length); }}
                        title="이전"
                      >◀</button>
                      <button
                        style={{
                          position: 'absolute', right: -12, top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#fff', border: '1.2px solid #eee',
                          borderRadius: '50%', width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontWeight: 800, fontSize: 16,
                          boxShadow: '0 2px 6px #0001', zIndex: 2
                        }}
                        tabIndex={-1}
                        onClick={e => { e.stopPropagation(); handleNext(idx, stages.length); }}
                        title="다음"
                      >▶</button>
                    </>
                  )}

                  {/* 이미지, 클릭시 이미지 선택 모달 */}
                  <div
                    style={{
                      marginBottom: 10, marginTop: 34, cursor: 'pointer',
                      width: 65, height: 65, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      setImageModalOpen(true);
                    }}
                    title="이미지 변경"
                  >
                    {item.image
                      ? <img src={item.image} alt="" style={{ width: 65, height: 65, objectFit: 'contain', borderRadius: 7, background: '#fff' }} />
                      : <span style={{ width: 54, height: 54, background: '#ececec', borderRadius: 7, display: 'inline-block' }} />}
                  </div>
                  <ImageSelectModal
                    open={imageModalOpen}
                    onClose={() => setImageModalOpen(false)}
                    onSelectImage={handleImageSelect}
                  />

                  {/* 이름 인라인 편집 */}
                  <div style={{
                    fontWeight: 700, fontSize: 20, marginBottom: 0, color: item.name ? '#333' : '#bbb', textAlign: 'center',
                    minHeight: 24, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {editingName ? (
                      <input
                        value={editNameValue}
                        onChange={e => setEditNameValue(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleNameSave();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                        style={{
                          fontSize: 20,
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
                        onClick={e => {
                          e.stopPropagation();
                          setEditNameValue(item.name || '');
                          setEditingName(true);
                        }}
                        title="이름 수정"
                      >
                        {item.name || <span style={{ color: '#bbb' }}>이름 없음</span>}
                      </span>
                    )}
                  </div>

                  {/* 가격 클릭 시 가격 수정 모달 */}
                  <div
                    style={{
                      fontWeight: 800, fontSize: 20, color: '#5b80f5', textAlign: 'center', letterSpacing: 1, marginTop: 3,
                      cursor: 'pointer', borderRadius: 8, padding: '2px 10px',
                      transition: 'background 0.1s', minHeight: 28
                    }}
                    title="가격 수정"
                    onClick={e => {
                      e.stopPropagation();
                      setPriceTableEdit({ blockPath: path, idx, item: { ...item, mode: guessPriceMode(item) } });
                    }}
                  >
                    {price}
                  </div>
                </div>
              );
            })}
            {children}
          </div>
        </div>
      );
    }

    // 여러 링크 블록을 한 줄에 렌더링
    case 'link-block-row': {
      return (
        <div {...attributes} contentEditable={false} style={{
          display: 'flex',
          gap: 12,
          margin: '8px 0',
          width: '100%',
        }}>
          {children}
        </div>
      );
    }

    // 알 수 없는 타입, 또는 커스텀 확장에 대한 기본 fallback
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      if (
        Array.isArray(children) &&
        children.length === 1 &&
        typeof children[0] === "string"
      ) {
        return <span {...attributes}>{children}</span>;
      }
      return <p {...attributes} style={{ textAlign }}>{children}</p>;
    }
  }
};

export default Element;
