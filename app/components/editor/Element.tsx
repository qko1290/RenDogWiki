'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  RenderElementProps,
  ReactEditor,
  useSelected,
  useFocused,
  useSlate,
} from 'slate-react';
import { Node, Transforms, Path, Element as SlateElement } from 'slate';

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
  TableElement,
  VideoElement,
  WeaponCardElement,
} from '@/types/slate';

import type { PriceTableEditState } from './render/types';
import PriceTableCard from './render/PriceTableCard';
import {
  TableElementRenderer,
  TableRowRenderer,
  TableCellRenderer,
} from './render/Table';
import WeaponCard from './render/WeaponCard';
import type { ElementRenderProps } from './render/types';

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
    <path
      d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"
      fill="currentColor"
    />
  </svg>
);

// -------------------- 타입 --------------------
export type ElementProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

type BlockComponentProps<E extends CustomElement = CustomElement> = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: E;
  editor: any;
};

// -------------------- 하위 컴포넌트: 링크 카드 --------------------
const LinkBlockView: React.FC<
  BlockComponentProps<LinkBlockElement>
> = ({ attributes, children, element, editor }) => {
  const el = element;
  const isReadOnly = ReactEditor.isReadOnly(editor);

  // 표시용 사이트 이름 (초기값용)
  let displaySitename = el.sitename;
  if (!el.isWiki && !displaySitename) {
    try {
      const u = new URL(el.url);
      const host = u.hostname.replace(/^www\./, '');
      if (!displaySitename) displaySitename = host;
    } catch {}
  }

  // 위키 아이콘 (문서 아이콘)
  const [wikiIcon, setWikiIcon] = useState<string | null>(
    el.isWiki ? (el as any).docIcon ?? null : null,
  );

  useEffect(() => {
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
          const res = await fetch('/api/documents?all=1', {
            cache: 'force-cache',
          });
          const data = await res.json();
          setWikiDocsAll(Array.isArray(data) ? data : []);
        }
        const docs = wikiDocsAll || [];
        const match = docs.find(
          (d: any) =>
            (el.wikiPath && String(d.path) === String(el.wikiPath)) ||
            (el.wikiTitle && d.title === el.wikiTitle),
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

    return () => {
      cancelled = true;
    };
  }, [el.isWiki, el.wikiPath, el.wikiTitle, el.url, wikiIcon]);

  // 외부 링크 파비콘 (https://사이트/favicon.ico 형태)
  let externalFavicon: string | null = null;
  if (!el.isWiki && el.url) {
    try {
      const u = new URL(el.url);
      externalFavicon = `${u.origin}/favicon.ico`;
    } catch {
      externalFavicon = null;
    }
  }

  const isSmall = el.size === 'small' || (el as any).size === 'half';

  // 부모가 link-block-row인지 여부
  let inRow = false;
  try {
    const path = ReactEditor.findPath(editor, element);
    const parent = Node.parent(editor as any, path);
    inRow =
      SlateElement.isElement(parent) &&
      (parent as any).type === 'link-block-row';
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

  // 공통 카드 내용 (아이콘 + 텍스트 영역)
  const CardInner = (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: 15,
        fontSize: 16,
        border: '1px solid #ddd',
        borderRadius: 6,
        marginBottom: 8,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 삭제 버튼 (편집 모드에서만) */}
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
          contentEditable={false}
        >
          ×
        </button>
      )}

      {/* 아이콘 (위키 아이콘 or 파비콘 or 기본 아이콘) */}
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
              style={{
                width: 24,
                height: 24,
                marginRight: 8,
                objectFit: 'contain',
                display: 'block',
              }}
              draggable={false}
              contentEditable={false}
            />
          ) : (
            <span
              style={{
                fontSize: 20,
                marginRight: 8,
                lineHeight: 1,
              }}
              contentEditable={false}
            >
              {wikiIcon}
            </span>
          )
        ) : null
      ) : externalFavicon ? (
        <img
          src={toProxyUrl(externalFavicon)}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{
            width: 20,
            height: 20,
            marginRight: 8,
            objectFit: 'contain',
            display: 'block',
          }}
          draggable={false}
          onError={(e) => {
            // 파비콘 로드 실패 시 그냥 숨김
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          contentEditable={false}
        />
      ) : (
        <span
          style={{
            width: 24,
            height: 24,
            marginRight: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
          aria-hidden
          contentEditable={false}
        >
          <ExternalLinkIcon size={18} />
        </span>
      )}

      {/* 텍스트 영역 */}
      {isReadOnly ? (
        // 🔹 읽기 모드: children + fallback (비어 있으면 사이트 이름)
        <span
          style={{
            flexGrow: 1,
            color: '#0070f3',
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {Node.string(el) ||
            (el.isWiki
              ? el.wikiTitle || el.sitename || '문서'
              : displaySitename || el.url)}
        </span>
      ) : (
        // 🔹 편집 모드: children 을 그대로 노출해서 직접 수정 가능
        <span
          style={{
            flexGrow: 1,
            minWidth: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {children}
        </span>
      )}
    </div>
  );

  // 🔹 읽기 모드: 카드 전체를 링크로 감싸서 클릭 시 이동
  if (isReadOnly) {
    return (
      <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
        <a
          href={el.url}
          target={el.isWiki ? undefined : '_blank'}
          rel={el.isWiki ? undefined : 'noopener noreferrer nofollow'}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          contentEditable={false}
        >
          {CardInner}
        </a>
      </div>
    );
  }

  // 🔹 편집 모드: 그냥 카드만 렌더 (앵커 없음 → 클릭해도 이동 X)
  return (
    <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
      {CardInner}
    </div>
  );
};

// -------------------- 하위 컴포넌트: 본문 이미지 --------------------
const ImageBlock: React.FC<
  BlockComponentProps<CustomElement>
> = ({ attributes, children, element, editor }) => {
  const el: any = element;
  const selected = useSelected();
  const focused = useFocused();
  const [modalOpen, setModalOpen] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [initSize, setInitSize] = useState<{ w?: number; h?: number }>({});

  const EditIcon = ({ size = 18, color = '#2a90ff' }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 17h3.8a1 1 0 0 0 .7-.3l8.4-8.4a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L3.3 12.2a1 1 0 0 0-.3.7V17z"
        stroke={color}
        strokeWidth="1.7"
      />
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

  const imgSrc =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

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
                const rectW = Math.round(
                  img?.getBoundingClientRect().width || 0,
                );
                const rectH = Math.round(
                  img?.getBoundingClientRect().height || 0,
                );
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
};

// -------------------- 하위 컴포넌트: video --------------------
const VideoBlock: React.FC<
  BlockComponentProps<VideoElement>
> = ({ attributes, children, element, editor }) => {
  const el = element;
  const selected = useSelected();
  const focused = useFocused();
  const [modalOpen, setModalOpen] = useState(false);

  let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
  if (el.textAlign === 'left') justifyContent = 'flex-start';
  else if (el.textAlign === 'right') justifyContent = 'flex-end';

  const handleSaveSize = (width: number, height: number) => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(editor, { width, height }, { at: path });
    setModalOpen(false);
  };

  const src =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

  return (
    <div {...attributes} style={{ margin: '16px 0' }}>
      <div
        key={el.textAlign || 'center'}
        contentEditable={false}
        style={{
          display: 'flex',
          justifyContent,
          alignItems: 'flex-start',
          minHeight: 40,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <video
            src={src}
            controls
            playsInline
            preload="metadata"
            style={{
              maxWidth: el.width ? el.width + 'px' : '90%',
              height: el.height ? el.height + 'px' : 'auto',
              borderRadius: 10,
              boxShadow: '0 2px 12px 0 #0001',
              background: '#000',
              display: 'block',
              outline: selected && focused ? '2px solid #2a90ff' : 'none',
              transition: 'outline 0.1s',
            }}
          />
          {selected && (
            <button
              type="button"
              aria-label="영상 크기 편집"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
              title="영상 크기 편집"
            >
              ⚙️
            </button>
          )}
        </div>
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
};

// -------------------- 메인 렌더러 --------------------
const Element: React.FC<ElementRenderProps> = ({
  attributes,
  children,
  element,
  editor,
  onIconClick,
  priceTableEdit,
  setPriceTableEdit,
}) => {
  const slateEditor = useSlate();

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
      return (
        <LinkBlockView
          attributes={attributes}
          element={element as LinkBlockElement}
          editor={editor}
        >
          {children}
        </LinkBlockView>
      );
    }

    // -------------------- Heading --------------------
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el =
        element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level =
        el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';

      const justify =
        el.textAlign === 'center'
          ? 'center'
          : el.textAlign === 'right'
          ? 'flex-end'
          : 'flex-start';

      return (
        <Tag
          {...attributes}
          id={getHeadingId(el)}
          style={{
            fontSize,
            textAlign: el.textAlign || 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: justify,
            width: '100%',
          }}
        >
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{
              cursor: 'pointer',
              marginRight: 8,
              display: 'inline-flex',
              alignItems: 'center',
            }}
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
                style={{
                  width: '1.7em',
                  height: '1.7em',
                  verticalAlign: 'middle',
                  marginRight: 6,
                  objectFit: 'contain',
                  display: 'block',
                }}
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
              <div
                style={{
                  width: '95%',
                  margin: '32px auto',
                  textAlign: 'center',
                }}
              >
                <hr
                  style={{
                    border: 0,
                    borderTop: `4px solid ${borderColor}`,
                    width: '100%',
                    margin: '0 auto',
                  }}
                />
              </div>
            )}
            {styleType === 'shortbold' && (
              <div
                style={{
                  width: 82,
                  margin: '34px auto',
                  textAlign: 'center',
                }}
              >
                <hr
                  style={{
                    border: 0,
                    borderTop: `5px solid ${borderColor}`,
                    width: '100%',
                    margin: '0 auto',
                  }}
                />
              </div>
            )}
            {styleType === 'dotted' && (
              <div
                style={{
                  width: '70%',
                  margin: '28px auto',
                  textAlign: 'center',
                }}
              >
                <hr
                  style={{
                    border: 0,
                    borderTop: `2px dotted ${borderColor}`,
                    width: '100%',
                    margin: '0 auto',
                  }}
                />
              </div>
            )}
            {styleType === 'diamond' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span
                  style={{
                    fontSize: 24,
                    letterSpacing: 12,
                    color: borderColor,
                  }}
                >
                  ◇───◇
                </span>
              </div>
            )}
            {styleType === 'diamonddot' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span
                  style={{
                    fontSize: 22,
                    letterSpacing: 6,
                    color: borderColor,
                  }}
                >
                  ◇ ⋅ ⋅ ⋅ ◇
                </span>
              </div>
            )}
            {styleType === 'dotdot' && (
              <div
                style={{
                  width: '100%',
                  margin: '30px 0',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    letterSpacing: 8,
                    color: borderColor,
                  }}
                >
                  • • • • • • •
                </span>
              </div>
            )}
            {styleType === 'slash' && (
              <div
                style={{
                  width: '100%',
                  margin: '30px 0',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 30,
                    letterSpacing: 14,
                    color: borderColor,
                  }}
                >
                  /  /  /
                </span>
              </div>
            )}
            {styleType === 'bar' && (
              <div
                style={{
                  width: '100%',
                  margin: '28px 0',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 22, color: borderColor }}>|</span>
              </div>
            )}
            {styleType === 'default' && (
              <div
                style={{
                  width: '95%',
                  margin: '24px auto',
                  textAlign: 'center',
                }}
              >
                <hr
                  style={{
                    border: 0,
                    borderTop: `1.5px solid ${borderColor}`,
                    width: '100%',
                    margin: '0 auto',
                  }}
                />
              </div>
            )}
          </div>
          {children}
        </div>
      );
    }

    // -------------------- 기본 문단 --------------------
    case 'paragraph': {
      const el = element as ParagraphElement;
      const indentLine = (el as any).indentLine;

      let extraClass = '';
      if (indentLine) {
        const path = ReactEditor.findPath(slateEditor, element);
        let isFirst = true,
          isLast = true;
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

    // -------------------- 인포박스 --------------------
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
          <span
            className="infobox__icon"
            aria-hidden="true"
            contentEditable={false}
          />
          <div className="infobox__body">{children}</div>
        </div>
      );
    }

    // -------------------- 본문 이미지 (void) --------------------
    case 'image': {
      return (
        <ImageBlock
          attributes={attributes}
          element={element as any}
          editor={editor}
        >
          {children}
        </ImageBlock>
      );
    }

    // -------------------- 인라인 이미지 --------------------
    case 'inline-image': {
      const el = element as InlineImageElement;
      const src = el.url?.startsWith('http') ? toProxyUrl(el.url) : el.url;
      return (
        <span
          {...attributes}
          contentEditable={false}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            style={{
              height: '2em',
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
            marginTop: 0,
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

    // -------------------- 가격표 카드 (void, 분리 컴포넌트) --------------------
    case 'price-table-card': {
      return (
        <PriceTableCard
          attributes={attributes}
          element={element as PriceTableCardElement}
          editor={editor}
          priceTableEdit={priceTableEdit}
          setPriceTableEdit={setPriceTableEdit}
        >
          {children}
        </PriceTableCard>
      );
    }

    // -------------------- 링크 블록 Row --------------------
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

    // -------------------- 표(Table) : 분리 컴포넌트 --------------------
    case 'table': {
      return (
        <TableElementRenderer
          attributes={attributes}
          element={element as TableElement}
          editor={editor}
        >
          {children}
        </TableElementRenderer>
      );
    }

    case 'table-row': {
      return (
        <TableRowRenderer attributes={attributes} element={element}>{children}</TableRowRenderer>
      );
    }

    case 'table-cell': {
      return (
        <TableCellRenderer attributes={attributes} element={element} editor={editor}>
          {children}
        </TableCellRenderer>
      );
    }

    // -------------------- video --------------------
    case 'video': {
      return (
        <VideoBlock
          attributes={attributes}
          element={element as VideoElement}
          editor={editor}
        >
          {children}
        </VideoBlock>
      );
    }

    // -------------------- Weapon Card (무기 정보 박스) : 분리 컴포넌트 --------------------
    case 'weapon-card': {
      return (
        <WeaponCard
          attributes={attributes}
          element={element as WeaponCardElement}
          editor={editor}
        >
          {children}
        </WeaponCard>
      );
    }

    // -------------------- 기본 fallback --------------------
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      if (
        Array.isArray(children) &&
        children.length === 1 &&
        typeof children[0] === 'string'
      ) {
        return <span {...attributes}>{children}</span>;
      }
      return React.createElement(
        'p',
        { ...attributes, style: { textAlign } },
        children,
      );
    }
  }
};

export default Element;
