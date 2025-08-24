// app/components/editor/Element.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  RenderElementProps,
  ReactEditor,
  useSelected,
  useFocused,
  useSlate,
  useSlateStatic,
} from 'slate-react';
import { Node, Transforms, Path, Editor, Element as SlateElement } from 'slate';
import { getHeadingId } from './helpers/getHeadingId';
import ImageSizeModal from './ImageSizeModal';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';
import type {
  InlineMarkElement,
  InlineImageElement,
  PriceTableCardElement,
  CustomElement,
  LinkBlockElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  ParagraphElement,
} from '@/types/slate';

// -------------------- 모듈 전역 캐시 (HMR 안전) --------------------
const WIKI_ICON_CACHE_KEY = '__rdwiki_doc_icon_cache__';
const WIKI_DOCS_ALL_KEY = '__rdwiki_docs_all__';

const wikiDocIconCache: Map<string, string> =
  (globalThis as any)[WIKI_ICON_CACHE_KEY] ?? new Map<string, string>();
(globalThis as any)[WIKI_ICON_CACHE_KEY] = wikiDocIconCache;

let wikiDocsAll: any[] | null = (globalThis as any)[WIKI_DOCS_ALL_KEY] ?? null;
const setWikiDocsAll = (rows: any[]) => {
  wikiDocsAll = rows;
  (globalThis as any)[WIKI_DOCS_ALL_KEY] = rows;
};

// 외부 링크용 인라인 아이콘
const ExternalLinkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z" fill="currentColor"/>
  </svg>
);

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
function guessPriceMode(item: any): 'normal' | 'awakening' | 'transcend' {
  if (!item.stages) return 'normal';
  const set = new Set(item.stages);
  if (item.stages.length === 6 && set.has('봉인') && set.has('MAX')) return 'awakening';
  if (item.stages.includes('거가') && item.stages.includes('거불')) return 'transcend';
  return 'normal';
}

// 길이에 따라 글자 크기 자동 축소
function autoFont(base: number, text: string, steps?: Array<[number, number]>) {
  const len = Array.from(text ?? '').length; // 유니코드 안전 길이
  const rules: Array<[number, number]> =
    steps ??
    [
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

function PriceText({ value }: { value: string | number }) {
  const s = String(value ?? '');
  if (!s.includes('~')) {
    return <span className="ptc-price-text">{s}</span>;
  }
  const [left, right] = s.split('~', 2);
  return (
    <span className="ptc-price-text">
      <span style={{ whiteSpace: 'nowrap' }}>{left}~</span>
      <wbr />
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </span>
  );
}

// -------------------- 타입 --------------------
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

// -------------------- 메인 렌더러 --------------------
const Element: React.FC<ElementProps> = ({
  attributes,
  children,
  element,
  editor,
  onIconClick,
  priceTableEdit, // eslint-disable-line @typescript-eslint/no-unused-vars
  setPriceTableEdit,
}) => {
  const slateEditor = useSlate();
  const editorStatic = useSlateStatic();
  const [hovered, setHovered] = useState<number | null>(null);

  switch (element.type) {
    // -------------------- 인라인 링크 --------------------
    case 'link': {
      return (
        <a
          {...attributes}
          href={(element as any).url}
          style={{ color: '#2676ff' }}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {children}
        </a>
      );
    }

    // -------------------- 카드형 링크 블록 (void) --------------------
    case 'link-block': {
      const el = element as LinkBlockElement;
      const isReadOnly = ReactEditor.isReadOnly(editor);

      let displaySitename = el.sitename;

      if (!el.isWiki && !displaySitename) {
        try {
          const u = new URL(el.url);
          const host = u.hostname.replace(/^www\./, '');
          if (!displaySitename) displaySitename = host;
        } catch {}
      }

      const [wikiIcon, setWikiIcon] = React.useState<string | null>(
        el.isWiki ? (el as any).docIcon ?? null : null
      );

      React.useEffect(() => {
        if (!el.isWiki || wikiIcon) return;
        const key = String(el.wikiPath ?? el.url ?? el.wikiTitle ?? '');
        if (!key) return;

        if (wikiDocIconCache.has(key)) {
          setWikiIcon(wikiDocIconCache.get(key)!);
          return;
        }

        let cancelled = false;
        (async () => {
          try {
            if (!wikiDocsAll) {
              const res = await fetch('/api/documents?all=1', { cache: 'force-cache' });
              const data = await res.json();
              setWikiDocsAll(Array.isArray(data) ? data : []);
            }
            const docs = wikiDocsAll || [];
            const match = docs.find(
              (d: any) =>
                (el.wikiPath && String(d.path) === String(el.wikiPath)) ||
                (el.wikiTitle && d.title === el.wikiTitle)
            );
            const icon = (match?.icon ?? '').trim();
            if (!cancelled) {
              if (icon) {
                setWikiIcon(icon);
                wikiDocIconCache.set(key, icon);
              } else {
                setWikiIcon(null);
              }
            }
          } catch {
            if (!cancelled) setWikiIcon(null);
          }
        })();

        return () => { cancelled = true; };
      }, [el.isWiki, el.wikiPath, el.wikiTitle, el.url, wikiIcon]);

      const isSmall = el.size === 'small' || (el as any).size === 'half';

      // 부모가 link-block-row인지 여부
      let inRow = false;
      try {
        const path = ReactEditor.findPath(editor, element);
        const parent = Node.parent(editor as any, path);
        inRow = SlateElement.isElement(parent) && (parent as any).type === 'link-block-row';
      } catch {}

      const wrapperStyle: React.CSSProperties = isSmall
        ? {
            display: inRow ? 'block' : 'inline-block',
            verticalAlign: 'top',
            width: 'calc(50% - 6px)',
            maxWidth: 'calc(50% - 6px)',
            marginRight: inRow ? 0 : 12,
          }
        : { display: 'block', width: '100%', maxWidth: '100%' };

      return (
        <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
          <div
            contentEditable={false}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 6,
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {!isReadOnly && (
              <button
                type="button"
                aria-label="링크 카드 삭제"
                onClick={() => {
                  const path = ReactEditor.findPath(editor, element);
                  Transforms.removeNodes(editor, { at: path });
                }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 6,
                  width: 20,
                  height: 20,
                  lineHeight: '20px',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  color: '#e11d48',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}

            {/* 아이콘 */}
            {el.isWiki ? (
              wikiIcon ? (
                wikiIcon.startsWith('http') ? (
                  <img
                    src={toProxyUrl(wikiIcon)}
                    alt="doc icon"
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    style={{ width: 24, height: 24, marginRight: 8, objectFit: 'contain', display: 'block' }}
                    draggable={false}
                  />
                ) : (
                  <span style={{ fontSize: 20, marginRight: 8, lineHeight: 1 }}>{wikiIcon}</span>
                )
              ) : null
            ) : (
              // 외부 파비콘 네트워크 호출 제거 → 인라인 아이콘
              <span
                style={{
                  width: 24,
                  height: 24,
                  marginRight: 8,
                  display: 'inline-flex',
                  alignItems:'center',
                  justifyContent:'center',
                  color:'#64748b'
                }}
                aria-hidden
              >
                <ExternalLinkIcon size={18} />
              </span>
            )}

            {/* 타이틀/링크 */}
            <a
              href={el.url}
              target={el.isWiki ? undefined : '_blank'}
              rel={el.isWiki ? undefined : 'noopener noreferrer nofollow'}
              style={{ color: '#0070f3', textDecoration: 'none', flexGrow: 1 }}
            >
              {el.isWiki ? el.wikiTitle || el.sitename || '문서' : displaySitename || el.url}
            </a>
          </div>

          {children}
        </div>
      );
    }

    // -------------------- Heading --------------------
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';

      return (
        <Tag
          {...attributes}
          id={getHeadingId(el)}
          style={{ fontSize, textAlign: el.textAlign || 'left', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{ cursor: 'pointer', marginRight: 8, display: 'inline-flex', alignItems: 'center' }}
          >
            {el.icon?.startsWith('http') ? (
              <img
                src={toProxyUrl(el.icon)}
                alt="icon"
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                style={{ width: '1.7em', height: '1.7em', verticalAlign: 'middle', marginRight: 6, objectFit: 'contain', display: 'block' }}
                draggable={false}
              />
            ) : (
              <span style={{ fontSize: '1.5em', marginRight: 6 }}>
                {el.icon || (level === 1 ? '📌' : level === 2 ? '🔖' : '📝')}
              </span>
            )}
          </span>
          <span style={{ display: 'inline' }}>{children}</span>
        </Tag>
      );
    }

    // -------------------- Divider (void) --------------------
    case 'divider': {
      const styleType = (element as any).style || 'default';
      const borderColor = '#e0e0e0';

      return (
        <div {...attributes}>
          <div contentEditable={false}>
            {styleType === 'bold' && (
              <div style={{ width: '95%', margin: '32px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `4px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'shortbold' && (
              <div style={{ width: 82, margin: '34px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `5px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'dotted' && (
              <div style={{ width: '70%', margin: '28px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `2px dotted ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'diamond' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: 24, letterSpacing: 12, color: borderColor }}>◇───◇</span>
              </div>
            )}
            {styleType === 'diamonddot' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: 22, letterSpacing: 6, color: borderColor }}>◇ ⋅ ⋅ ⋅ ◇</span>
              </div>
            )}
            {styleType === 'dotdot' && (
              <div style={{ width: '100%', margin: '30px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 28, letterSpacing: 8, color: borderColor }}>• • • • • • •</span>
              </div>
            )}
            {styleType === 'slash' && (
              <div style={{ width: '100%', margin: '30px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 30, letterSpacing: 14, color: borderColor }}>/  /  /</span>
              </div>
            )}
            {styleType === 'bar' && (
              <div style={{ width: '100%', margin: '28px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 22, color: borderColor }}>|</span>
              </div>
            )}
            {styleType === 'default' && (
              <div style={{ width: '95%', margin: '24px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `1.5px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
          </div>
          {children}
        </div>
      );
    }

    // -------------------- 기본 단락 --------------------
    case 'paragraph': {
      const el = element as ParagraphElement;
      const indentLine = (el as any).indentLine;

      let extraClass = '';
      if (indentLine) {
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
        if (isFirst) extraClass += ' start';
        if (isLast) extraClass += ' end';
      }

      return (
        <p
          {...attributes}
          style={{
            textAlign: el.textAlign || 'left',
            borderLeft: indentLine ? '2px solid #D5D9E0' : undefined,
            paddingLeft: indentLine ? 16 : undefined,
            margin: 0,
          }}
          className={indentLine ? `slate-indent-line${extraClass}` : undefined}
        >
          {children}
        </p>
      );
    }

    // -------------------- 정보 박스 --------------------
    case 'info-box': {
      const raw =
        (element as any).boxType ||
        (element as any).variant ||
        (element as any).tone ||
        (element as any).infoType ||
        'note';

      const tone: 'note' | 'warn' | 'danger' | 'tip' =
        raw === 'danger' || raw === 'error'
          ? 'danger'
          : raw === 'warn' || raw === 'warning'
          ? 'warn'
          : raw === 'tip' || raw === 'success'
          ? 'tip'
          : 'note';

      return (
        <div {...attributes} className={`infobox infobox--${tone}`}>
          <span className="infobox__icon" aria-hidden="true" contentEditable={false} />
          <div className="infobox__body">{children}</div>
        </div>
      );
    }

    // -------------------- 본문 내 삽입 이미지 (void) --------------------
    case 'image': {
      const el = element as any;
      const selected = useSelected();
      const focused = useFocused();
      const [modalOpen, setModalOpen] = useState(false);

      const imgRef = useRef<HTMLImageElement | null>(null);
      const [initSize, setInitSize] = useState<{ w?: number; h?: number }>({});

      const EditIcon = ({ size = 18, color = '#2a90ff' }) => (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 17h3.8a1 1 0 0 0 .7-.3l8.4-8.4a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L3.3 12.2a1 1 0 0 0-.3.7V17z" stroke={color} strokeWidth="1.7" />
          <path d="M11.7 6.3l2.5 2.5" stroke={color} strokeWidth="1.7" />
        </svg>
      );

      let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (el.textAlign === 'left') justifyContent = 'flex-start';
      else if (el.textAlign === 'right') justifyContent = 'flex-end';

      const handleSaveSize = (width: number, height: number) => {
        const path = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { width, height }, { at: path });
        setModalOpen(false);
      };

      const imgSrc = typeof el.url === 'string' && el.url.startsWith('http') ? toProxyUrl(el.url) : el.url;

      return (
        <div {...attributes} style={{ margin: '16px 0' }}>
          <div
            key={el.textAlign || 'center'}
            contentEditable={false}
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent,
              alignItems: 'flex-start',
              minHeight: 40,
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imgSrc}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                draggable={false}
                style={{
                  maxWidth: el.width ? el.width + 'px' : '90%',
                  height: el.height ? el.height + 'px' : 'auto',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px 0 #0001',
                  background: '#fff',
                  display: 'block',
                  border: selected && focused ? '2px solid #2a90ff' : 'none',
                  transition: 'border 0.1s',
                }}
              />
              {selected && (
                <button
                  type="button"
                  aria-label="이미지 크기 편집"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const img = imgRef.current;
                    const rectW = Math.round(img?.getBoundingClientRect().width || 0);
                    const rectH = Math.round(img?.getBoundingClientRect().height || 0);
                    const natW = img?.naturalWidth || 0;
                    const natH = img?.naturalHeight || 0;

                    const w = el.width || rectW || natW || 256;
                    const h = el.height || rectH || natH || 256;
                    setInitSize({ w, h });
                    setModalOpen(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#fff',
                    border: '1.5px solid #2a90ff',
                    borderRadius: '50%',
                    boxShadow: '0 1px 5px #0001',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 1,
                    padding: 0,
                  }}
                  tabIndex={-1}
                  title="이미지 크기 편집"
                >
                  <EditIcon size={18} color="#2a90ff" />
                </button>
              )}
            </div>
          </div>

          {children}

          <ImageSizeModal
            open={modalOpen}
            width={initSize.w}
            height={initSize.h}
            onSave={handleSaveSize}
            onClose={() => setModalOpen(false)}
          />
        </div>
      );
    }

    // -------------------- 인라인 이미지 --------------------
    case 'inline-image': {
      const el = element as InlineImageElement;
      const src = el.url?.startsWith('http') ? toProxyUrl(el.url) : el.url;
      return (
        <span {...attributes} contentEditable={false} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            style={{ height: '3em', width: 'auto', display: 'inline', verticalAlign: 'middle', margin: '0 2px', borderRadius: 4 }}
          />
          {children}
        </span>
      );
    }

    // -------------------- 인라인 마크 --------------------
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

    // -------------------- 가격표 카드 블럭 (void) --------------------
    case 'price-table-card': {
      const el = element as PriceTableCardElement;
      const path = ReactEditor.findPath(editorStatic, el);

      useEffect(() => {
        const handler = (e: KeyboardEvent) => {
          const { selection } = editorStatic;
          if (!selection || !ReactEditor.isFocused(editorStatic)) return;
          const [node] = Editor.node(editorStatic, selection, { depth: 1 });
          if (SlateElement.isElement(node) && node.type === 'price-table-card' && e.key === 'Backspace') {
            e.preventDefault();
          }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
      }, [editorStatic]);

      const [stageIdxArr, setStageIdxArr] = useState(el.items.map(() => 0));
      useEffect(() => {
        setStageIdxArr(el.items.map(() => 0));
      }, [el.items]);

      const handlePrev = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)));
      };
      const handleNext = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v + 1) % len : v)));
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
              onClick={e => {
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
                const stages: string[] = item.stages || ['가격'];
                const prices: Array<string | number> =
                  Array.isArray(item.prices) && item.prices.length ? item.prices : [0];

                const curIdx = stageIdxArr[idx] ?? 0;
                const stage = stages[curIdx] ?? '';
                const priceText = String(prices[curIdx] ?? '');

                const badgeColor = getPriceBadgeColor(stage, item.colorType);

                const [editingName, setEditingName] = useState(false);
                const [editNameValue, setEditNameValue] = useState(item.name || '');
                const [imageModalOpen, setImageModalOpen] = useState(false);

                const handleImageSelect = (url: string) => {
                  const newItems = el.items.map((itm, i) => (i === idx ? { ...itm, image: url } : itm));
                  Transforms.setNodes(editorStatic, { items: newItems }, { at: path });
                  setImageModalOpen(false);
                };

                const handleNameSave = () => {
                  const newItems = el.items.map((itm, i) => (i === idx ? { ...itm, name: editNameValue } : itm));
                  Transforms.setNodes(editorStatic, { items: newItems }, { at: path });
                  setEditingName(false);
                };

                const imgSrc = item.image?.startsWith?.('http') ? toProxyUrl(item.image) : item.image;

                const nameShown = item.name || '이름 없음';
                const nameFont = autoFont(20, String(nameShown), [
                  [8, 20],
                  [12, 18],
                  [16, 16],
                  [22, 14],
                  [30, 13],
                ]);
                const priceFont = autoFont(20, priceText, [
                  [8, 20],
                  [12, 18],
                  [16, 16],
                  [22, 14],
                  [30, 12],
                  [40, 11],
                ]);

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
                      margin: '0 8px',
                    }}
                    onMouseEnter={() => setHovered(idx)}
                    onMouseLeave={() => setHovered(null)}
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

                    {hovered === idx && (
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
                          onClick={e => {
                            e.stopPropagation();
                            handlePrev(idx, stages.length);
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
                          onClick={e => {
                            e.stopPropagation();
                            handleNext(idx, stages.length);
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
                        marginTop: 34,
                        cursor: 'pointer',
                        width: 65,
                        height: 65,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={e => {
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
                          style={{ width: 65, height: 65, objectFit: 'contain', borderRadius: 7, background: '#fff', display: 'block' }}
                          draggable={false}
                        />
                      ) : (
                        <span style={{ width: 54, height: 54, background: '#ececec', borderRadius: 7, display: 'inline-block' }} />
                      )}
                    </div>
                    <ImageSelectModal
                      open={imageModalOpen}
                      onClose={() => setImageModalOpen(false)}
                      onSelectImage={handleImageSelect}
                    />

                    {/* 이름: 길면 폰트 축소 */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: nameFont,
                        marginBottom: 0,
                        color: item.name ? '#333' : '#bbb',
                        textAlign: 'center',
                        minHeight: 24,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1.15,
                        wordBreak: 'break-word',
                      }}
                    >
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
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#333',
                            textAlign: 'center',
                            border: '1.5px solid #b4cafe',
                            borderRadius: 6,
                            padding: '2px 6px',
                            outline: 'none',
                            width: '86%',
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
                          {nameShown || <span style={{ color: '#bbb' }}>이름 없음</span>}
                        </span>
                      )}
                    </div>

                    {/* 가격: 문자열 허용 + 길면 폰트 축소 */}
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 20,
                        color: '#5b80f5',
                        textAlign: 'center',
                        letterSpacing: 1,
                        marginTop: 3,
                        cursor: 'pointer',
                        borderRadius: 8,
                        padding: '2px 10px',
                        transition: 'background 0.1s',
                        minHeight: 28,
                      }}
                      title="가격 수정"
                      onClick={e => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('editor:capture-scroll'));
                        setPriceTableEdit({ blockPath: path, idx, item: { ...item, mode: guessPriceMode(item) } });
                      }}
                    >
                      <PriceText value={price as any} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {children}
        </div>
      );
    }

    // -------------------- 한 줄에 여러 링크 블록 --------------------
    case 'link-block-row': {
      return (
        <div
          {...attributes}
          style={{
            display: 'flex',
            gap: 12,
            margin: '8px 0',
            width: '100%',
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          {children}
        </div>
      );
    }

    // -------------------- 기본 fallback --------------------
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return <span {...attributes}>{children}</span>;
      }
      return (
        <p {...attributes} style={{ textAlign }}>
          {children}
        </p>
      );
    }
  }
};

export default Element;
