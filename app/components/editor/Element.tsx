'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import { extractHeadings } from '@/wiki/lib/extractHeadings';

import type {
  InlineMarkElement,
  InlineImageElement,
  FootnoteElement,
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
import type { ElementRenderProps, WikiRefKind } from './render/types';

// -------------------- 모듈 전역 캐시 (HMR 안전) --------------------
const WIKI_ICON_CACHE_KEY = '__rdwiki_doc_icon_cache__';
const WIKI_DOCS_ALL_KEY = '__rdwiki_docs_all__';
const WIKI_DOC_DETAIL_CACHE_KEY = '__rdwiki_doc_detail_cache__';

const wikiDocIconCache: Map<string, string> =
  (globalThis as any)[WIKI_ICON_CACHE_KEY] ?? new Map<string, string>();
(globalThis as any)[WIKI_ICON_CACHE_KEY] = wikiDocIconCache;

let wikiDocsAll: any[] | null = (globalThis as any)[WIKI_DOCS_ALL_KEY] ?? null;
const setWikiDocsAll = (rows: any[]) => {
  wikiDocsAll = rows;
  (globalThis as any)[WIKI_DOCS_ALL_KEY] = rows;
};

type WikiDocHeadingMeta = { id: string; icon?: string | null };
type WikiDocDetail = { icon?: string | null; headings: WikiDocHeadingMeta[] };

const wikiDocDetailCache: Map<string, WikiDocDetail> =
  (globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] ??
  new Map<string, WikiDocDetail>();
(globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] = wikiDocDetailCache;

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
const LinkBlockView: React.FC<BlockComponentProps<LinkBlockElement>> = ({
  attributes,
  children,
  element,
  editor,
}) => {
  const el = element;
  const isReadOnly = ReactEditor.isReadOnly(editor);

  // URL 파싱 (client / server 모두 안전하게)
  const parsedUrl = useMemo(() => {
    if (!el.url) return null;
    try {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://dummy.local';
      return new URL(el.url, base);
    } catch {
      return null;
    }
  }, [el.url]);

  // 내부 위키 링크 여부 자동 판별
  const isWikiLink = useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    if (typeof window === 'undefined') {
      return parsedUrl.pathname.startsWith('/wiki');
    }

    const sameHost = parsedUrl.host === window.location.host;
    return sameHost && parsedUrl.pathname.startsWith('/wiki');
  }, [el.isWiki, parsedUrl]);

  // 표시용 사이트 이름 (초기값용)
  let displaySitename = el.sitename;
  if (!isWikiLink && !displaySitename && parsedUrl) {
    const host = parsedUrl.hostname.replace(/^www\./, '');
    displaySitename = host;
  }

  const subtitleText = React.useMemo(() => {
    // ✅ 탭처럼 "대표 이름"만 노출 (path/title/hash/전체 url 금지)
    if (isWikiLink) {
      const s = (el.sitename ?? '').trim();
      return s || 'RenDog Wiki';
    }

    // 외부 링크: sitename 우선, 없으면 hostname
    const s = (el.sitename ?? '').trim();
    if (s) return s;

    if (parsedUrl) {
      return parsedUrl.hostname.replace(/^www\./, '');
    }

    return '';
  }, [isWikiLink, parsedUrl, el.sitename]);

  // 위키 아이콘 (문서/목차 아이콘)
  const [wikiIcon, setWikiIcon] = useState<string | null>(
    el.isWiki ? (el as any).docIcon ?? null : null,
  );

  // ✅ 내부 위키 링크면: path/title/hash 기준으로 문서/목차 아이콘 자동 선택
  useEffect(() => {
    if (!isWikiLink || !parsedUrl) return;
    if (typeof window === 'undefined') return;

    const urlObj = parsedUrl;
    const pathParam = urlObj.searchParams.get('path');
    const titleParam = urlObj.searchParams.get('title');

    const rawHash = urlObj.hash ? urlObj.hash.slice(1) : '';
    const decodedHash = rawHash ? decodeURIComponent(rawHash) : '';

    const docKeyParts: string[] = [];
    if (pathParam) docKeyParts.push(`p:${pathParam}`);
    if (titleParam) docKeyParts.push(`t:${titleParam}`);
    const baseDocKey = docKeyParts.join('|') || urlObj.pathname;

    const cacheKey = `${baseDocKey}#${decodedHash || 'root'}`;

    if (wikiDocIconCache.has(cacheKey)) {
      const cached = wikiDocIconCache.get(cacheKey);
      if (cached) setWikiIcon(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let detail = wikiDocDetailCache.get(baseDocKey);
        if (!detail) {
          let res: Response | null = null;
          if (pathParam || titleParam) {
            const qs: string[] = [];
            if (pathParam) qs.push(`path=${encodeURIComponent(pathParam)}`);
            if (titleParam) qs.push(`title=${encodeURIComponent(titleParam)}`);
            const query = qs.join('&');
            res = await fetch(`/api/documents?${query}`, { cache: 'force-cache' });
          }

          if (!res || !res.ok) {
            wikiDocIconCache.set(cacheKey, '');
            return;
          }

          const data = await res.json();
          const rawContent = (data as any).content;
          const slateContent =
            typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

          let headingsMeta: WikiDocHeadingMeta[] = [];
          try {
            const hs = extractHeadings(Array.isArray(slateContent) ? slateContent : []);
            headingsMeta = hs.map((h: any) => ({
              id: String(h.id ?? ''),
              icon: h.icon ?? null,
            }));
          } catch {
            headingsMeta = [];
          }

          detail = {
            icon: ((data as any).icon ?? '').trim() || null,
            headings: headingsMeta,
          };
          wikiDocDetailCache.set(baseDocKey, detail);
        }

        let iconCandidate: string | null = null;
        if (decodedHash && detail.headings.length > 0) {
          const target = decodedHash;
          const normalizedTarget = target.startsWith('heading-')
            ? target
            : `heading-${target}`;

          const matched = detail.headings.find((h) => {
            const hid = h.id || '';
            const hidNorm = hid.startsWith('heading-') ? hid : `heading-${hid}`;
            return (
              hid === target ||
              hid === normalizedTarget ||
              hidNorm === target ||
              hidNorm === normalizedTarget
            );
          });

          if (matched?.icon) iconCandidate = matched.icon || null;
        }

        if (!iconCandidate) iconCandidate = detail.icon || null;

        if (!cancelled) {
          if (iconCandidate) {
            setWikiIcon(iconCandidate);
            wikiDocIconCache.set(cacheKey, iconCandidate);
          } else {
            wikiDocIconCache.set(cacheKey, '');
          }
        }
      } catch {
        if (!cancelled) wikiDocIconCache.set(cacheKey, '');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isWikiLink, parsedUrl]);

  // ✅ 외부 링크 파비콘 유지 (원하시는대로)
  let externalFavicon: string | null = null;
  if (!isWikiLink && parsedUrl) {
    externalFavicon = `${parsedUrl.origin}/favicon.ico`;
  }

  const isSmall = el.size === 'small' || (el as any).size === 'half';

  // 부모가 link-block-row인지 여부 (기존 레이아웃 유지)
  let inRow = false;
  try {
    const path = ReactEditor.findPath(editor, element);
    const parent = Node.parent(editor as any, path);
    inRow =
      SlateElement.isElement(parent) && (parent as any).type === 'link-block-row';
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

  // ✅ 아래 줄(서브텍스트): "path=.. · title=.." 형태로 축약해서 표시
  const compactSubText = useMemo(() => {
    if (!parsedUrl) return '';

    const dot = ' · ';
    const parts: string[] = [];

    if (isWikiLink) {
      const p =
        parsedUrl.searchParams.get('path') ??
        ((el as any).wikiPath != null ? String((el as any).wikiPath) : null);
      const t =
        parsedUrl.searchParams.get('title') ??
        ((el as any).wikiTitle != null ? String((el as any).wikiTitle) : null);

      if (p) parts.push(`path=${p}`);
      if (t) parts.push(`title=${t}`);

      // 해시가 있으면 너무 길지 않게만 표시
      const rawHash = parsedUrl.hash ? parsedUrl.hash.slice(1) : '';
      const decoded = rawHash
        ? (() => {
            try {
              return decodeURIComponent(rawHash);
            } catch {
              return rawHash;
            }
          })()
        : '';
      if (decoded) {
        const clean = decoded.startsWith('heading-') ? decoded.slice(8) : decoded;
        const short = clean.length > 26 ? `${clean.slice(0, 26)}…` : clean;
        parts.push(`#${short}`);
      }

      return parts.join(dot) || 'wiki';
    }

    // 외부는 전체 주소/쿼리 노출하지 말고 "host + (path)" 정도만
    const host = parsedUrl.hostname.replace(/^www\./, '');
    const pathname = (parsedUrl.pathname || '').trim();
    const pathShort =
      pathname && pathname !== '/' ? (pathname.length > 18 ? `${pathname.slice(0, 18)}…` : pathname) : '';
    return [host, pathShort].filter(Boolean).join(dot);
  }, [parsedUrl, isWikiLink, el]);

  // ✅ 대표 이름(탭 제목처럼) - path/title 같은 값이 sitename에 들어가 있어도 무시
  const siteLabel = useMemo(() => {
    const clean = (s?: string | null) => (s ?? '').trim();

    // sitename에 path/title/url 같은 찌꺼기가 들어간 경우 무시
    const isGarbage = (s: string) =>
      !s ||
      /path\s*=|title\s*=|#heading-|https?:\/\/|\/wiki|[?&]=|%[0-9A-Fa-f]{2}/.test(s);

    if (isWikiLink) return 'RenDog Wiki';

    const s = clean(el.sitename);
    if (s && !isGarbage(s)) return s;

    if (parsedUrl) return parsedUrl.hostname.replace(/^www\./, '');
    return '';
  }, [isWikiLink, parsedUrl, el.sitename]);

  // 공통 카드 내용 (아이콘 + 텍스트 영역)
  const CardInner = (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px',
        border: '1.6px solid #c7d2fe',
        borderRadius: 14,
        background: '#ffffff',
        boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 10px 26px rgba(15,23,42,0.08)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 8px 22px rgba(15,23,42,0.06)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#c7d2fe';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* 삭제 버튼 (편집 모드에서만) - ✅ 오른쪽 위 경계에 "걸치게" */}
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
            top: -10,
            right: -10,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: '#fff',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 10px 22px rgba(15,23,42,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 2,
          }}
          contentEditable={false}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1,
              color: '#e11d48',
              transform: 'translateY(-.5px)',
            }}
          >
            ×
          </span>
        </button>
      )}

      {/* 아이콘 */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          overflow: 'hidden',
        }}
        contentEditable={false}
      >
        {isWikiLink ? (
          wikiIcon ? (
            wikiIcon.startsWith('http') ? (
              <img
                src={toProxyUrl(wikiIcon)}
                alt="doc icon"
                width={30}
                height={30}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                style={{
                  width: 30,
                  height: 30,
                  objectFit: 'contain',
                  display: 'block',
                }}
                draggable={false}
                contentEditable={false}
              />
            ) : (
              <span style={{ fontSize: 22, lineHeight: 1 }} contentEditable={false}>
                {wikiIcon}
              </span>
            )
          ) : (
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden contentEditable={false}>
              📄
            </span>
          )
        ) : externalFavicon ? (
          <img
            src={toProxyUrl(externalFavicon)}
            alt=""
            width={22}
            height={22}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
              display: 'block',
            }}
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            contentEditable={false}
          />
        ) : (
          <span style={{ color: '#64748b', display: 'flex' }} aria-hidden contentEditable={false}>
            <ExternalLinkIcon size={18} />
          </span>
        )}
      </div>

      {/* 텍스트 영역: 제목 + 대표 이름 */}
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        {isReadOnly ? (
          <>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {Node.string(el) ||
                (isWikiLink
                  ? (el as any).wikiTitle || el.sitename || '문서'
                  : displaySitename || el.url)}
            </div>

            {/* ✅ 대표 이름만 출력 */}
            <div
              style={{
                marginTop: 2,
                fontSize: 12.5,
                fontWeight: 650,
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {siteLabel}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#0f172a',
                minWidth: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.25,
              }}
            >
              {children}
            </div>

            {/* 편집 모드에서도 동일 */}
            <div
              style={{
                marginTop: 2,
                fontSize: 12.5,
                fontWeight: 650,
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              contentEditable={false}
            >
              {siteLabel}
            </div>
          </>
        )}
      </div>

      {/* 오른쪽 화살표 느낌(선택) */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#334155',
          flex: '0 0 auto',
          fontWeight: 900,
        }}
        aria-hidden
        contentEditable={false}
      >
        →
      </div>
    </div>
  );

  // 읽기 모드: 카드 전체 링크
  if (isReadOnly) {
    return (
      <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
        <a
          href={el.url}
          target={isWikiLink ? undefined : '_blank'}
          rel={isWikiLink ? undefined : 'noopener noreferrer nofollow'}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
          }}
          contentEditable={false}
        >
          {CardInner}
        </a>
      </div>
    );
  }

  // 편집 모드: 카드만
  return (
    <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
      {CardInner}
    </div>
  );
};

// -------------------- 하위 컴포넌트: 본문 이미지 --------------------
const ImageBlock: React.FC<BlockComponentProps<CustomElement>> = ({
  attributes,
  children,
  element,
  editor,
}) => {
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
};

// -------------------- 하위 컴포넌트: video --------------------
const VideoBlock: React.FC<BlockComponentProps<VideoElement>> = ({
  attributes,
  children,
  element,
  editor,
}) => {
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
  openFootnoteEditor,
  readOnly,
  onWikiRefClick,
  onOpenWikiRef,
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
        element as
          | HeadingOneElement
          | HeadingTwoElement
          | HeadingThreeElement;
      const level =
        el.type === 'heading-one'
          ? 1
          : el.type === 'heading-two'
          ? 2
          : 3;
      const fontSize =
        level === 1 ? '28px' : level === 2 ? '22px' : '18px';
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
                {el.icon ||
                  (level === 1
                    ? '📌'
                    : level === 2
                    ? '🔖'
                    : '📝')}
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
            fontSize: '19px',
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

      // ✅ 새 색상 타입 포함
      const isColor =
        raw === 'white' || raw === 'yellow' || raw === 'lime' || raw === 'pink' || raw === 'red';

      const tone:
        | 'note'
        | 'warn'
        | 'danger'
        | 'tip'
        | 'white'
        | 'yellow'
        | 'lime'
        | 'pink'
        | 'red' =
        raw === 'danger' || raw === 'error'
          ? 'danger'
          : raw === 'warn' || raw === 'warning'
          ? 'warn'
          : raw === 'tip' || raw === 'success'
          ? 'tip'
          : isColor
          ? (raw as any)
          : 'note';

      const noIcon = Boolean((element as any).noIcon) || isColor;

      // ✅ CSS 없을 때도 바로 보이게 "최소 인라인 스타일" (원하면 나중에 CSS로 빼도 됨)
      const style: React.CSSProperties | undefined = isColor
        ? tone === 'white'
          ? { background: '#ffffff', border: '1px solid #d6d6d6' }
          : tone === 'yellow'
          ? { background: '#fff6cc', border: '1px solid #f0d36a' }
          : tone === 'lime'
          ? { background: '#e9ffd0', border: '1px solid #a7d86a' }
          : tone === 'pink'
          ? { background: '#ffe1ea', border: '1px solid #f2a7c2' }
          : { background: '#ffd7d7', border: '1px solid #ff9a9a' } // red
        : undefined;

      return (
        <div {...attributes} className={`infobox infobox--${tone}`} style={style}>
          {!noIcon && (
            <span className="infobox__icon" aria-hidden="true" contentEditable={false} />
          )}
          <div className="infobox__body" style={{ whiteSpace: 'pre-wrap' }}>
            {children}
          </div>
        </div>
      );
    }

    // -------------------- 본문 이미지 (void) --------------------
    case 'image': {
      return (
        <ImageBlock attributes={attributes} element={element as any} editor={editor}>
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

    // -------------------- 각주 (inline void) --------------------
    case 'footnote': {
      const el = element as FootnoteElement;

      return (
        <span
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          data-footnote="true"
          title="우클릭하여 각주 수정"
          onContextMenu={(e) => {
            if (!openFootnoteEditor) return;
            e.preventDefault();
            e.stopPropagation();

            try {
              const path = ReactEditor.findPath(slateEditor, element);
              openFootnoteEditor(path, el);
            } catch {
              // path 찾기 실패 시 조용히 무시
            }
          }}
          style={{
            display: 'inline-block',
            verticalAlign: 'super',
            position: 'relative',
            top: '-0.05em',
            marginLeft: 1,
            marginRight: 1,
            padding: 0,
            background: 'transparent',
            borderRadius: 0,
            color: '#7c3aed',
            fontSize: '12px',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: 0,
            userSelect: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          [{(el.label ?? '').trim() || '각주'}]
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
        <TableRowRenderer attributes={attributes} element={element}>
          {children}
        </TableRowRenderer>
      );
    }

    case 'table-cell': {
      return (
        <TableCellRenderer
          attributes={attributes}
          element={element}
          editor={editor}
        >
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

    // -------------------- Wiki DB Embed (Quest/NPC/QNA) --------------------
    case 'quest-embed':
    case 'npc-embed':
    case 'qna-embed': {
      const t = element.type;
      const id =
        t === 'quest-embed'
          ? (element as any).questId
          : t === 'npc-embed'
          ? (element as any).npcId
          : (element as any).qnaId;

      const label = t === 'quest-embed' ? '퀘스트' : t === 'npc-embed' ? 'NPC' : 'QNA';

      return (
        <div {...attributes}>
          <div
            contentEditable={false}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: '12px 14px',
              background: '#fff',
              boxShadow: '0 8px 24px rgba(16,24,40,0.04)',
              margin: '10px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🧩</span>
              <div style={{ fontWeight: 900 }}>{label} 삽입</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>ID: {String(id ?? '-')}</div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12.5 }}>나중에 id로 데이터 로드</div>
          </div>
          {children}
        </div>
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

    case 'wiki-ref': {
      const kind = (element as any).kind as WikiRefKind;
      const refId = Number((element as any).id);
      const open = onWikiRefClick ?? onOpenWikiRef;

      return (
        <span
          {...attributes}
          role={readOnly ? 'button' : undefined}
          tabIndex={readOnly ? 0 : -1}
          title={`${String(kind).toUpperCase()} #${refId}`}
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            cursor: readOnly && open ? 'pointer' : 'default',
          }}
          onMouseDown={(e) => {
            if (!readOnly) return;
            if (!open) return;
            e.preventDefault();
            open(kind, refId);
          }}
          onKeyDown={(e) => {
            if (!readOnly) return;
            if (!open) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(kind, refId);
            }
          }}
        >
          {children}
        </span>
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
