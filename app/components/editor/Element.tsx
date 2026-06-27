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
import { cdn, toProxyUrl, withVersion } from '@lib/cdn';
import SmartImage from '@/components/common/SmartImage';
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
import DividerBlock from '@/components/wiki-render/blocks/DividerBlock';
import ParagraphBlock from '@/components/wiki-render/blocks/ParagraphBlock';
import HeadingBlock from '@/components/wiki-render/blocks/HeadingBlock';
import InfoBoxBlock from '@/components/wiki-render/blocks/InfoBoxBlock';
import MediaBlock from '@/components/wiki-render/blocks/MediaBlock';
import LinkCardBlock from '@/components/wiki-render/blocks/LinkCardBlock';

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

function normalizeHostForWikiLink(hostname: string | null | undefined) {
  return String(hostname ?? '')
    .trim()
    .replace(/^www\./i, '')
    .toLowerCase();
}

function isKnownRdwikiHost(hostname: string | null | undefined) {
  const host = normalizeHostForWikiLink(hostname);

  if (!host) return false;

  return (
    host === 'ren-dog-wiki.vercel.app' ||
    (host.startsWith('ren-dog-wiki-') && host.endsWith('.vercel.app')) ||
    host.endsWith('qko1290s-projects.vercel.app')
  );
}

function isRdwikiWikiUrl(urlObj: URL) {
  if (!urlObj.pathname.startsWith('/wiki')) return false;

  if (typeof window === 'undefined') {
    return true;
  }

  const currentHost = normalizeHostForWikiLink(window.location.hostname);
  const targetHost = normalizeHostForWikiLink(urlObj.hostname);

  return targetHost === currentHost || isKnownRdwikiHost(targetHost);
}

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

  const isWikiLink = useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [el.isWiki, parsedUrl]);

  let displaySitename = el.sitename;

  if (!isWikiLink && !displaySitename && parsedUrl) {
    displaySitename = parsedUrl.hostname.replace(/^www\./, '');
  }

  const [wikiIcon, setWikiIcon] = useState(
    el.isWiki ? (el as any).docIcon ?? null : null
  );

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

        if (!iconCandidate) {
          iconCandidate = detail.icon || null;
        }

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

  let externalFavicon: string | null = null;

  if (!isWikiLink && parsedUrl) {
    externalFavicon = `${parsedUrl.origin}/favicon.ico`;
  }

  const isSmall = el.size === 'small' || (el as any).size === 'half';

  let inRow = false;

  try {
    const path = ReactEditor.findPath(editor, element);
    const parent = Node.parent(editor as any, path);

    inRow =
      SlateElement.isElement(parent) &&
      (parent as any).type === 'link-block-row';
  } catch {}

  const siteLabel = useMemo(() => {
    const clean = (s?: string | null) => (s ?? '').trim();

    const isGarbage = (s: string) =>
      !s ||
      /path\s*=|title\s*=|#heading-|https?:\/\/|\/wiki|[?&]=|%[0-9A-Fa-f]{2}/.test(s);

    if (isWikiLink) return 'RenDog Wiki';

    const s = clean(el.sitename);

    if (s && !isGarbage(s)) return s;
    if (parsedUrl) return parsedUrl.hostname.replace(/^www\./, '');

    return '';
  }, [isWikiLink, parsedUrl, el.sitename]);

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
        const clean = decoded.startsWith('heading-')
          ? decoded.slice(8)
          : decoded;

        const short = clean.length > 26 ? `${clean.slice(0, 26)}…` : clean;
        parts.push(`#${short}`);
      }

      return parts.join(dot) || 'wiki';
    }

    const host = parsedUrl.hostname.replace(/^www\./, '');
    const pathname = (parsedUrl.pathname || '').trim();

    const pathShort =
      pathname && pathname !== '/'
        ? pathname.length > 18
          ? `${pathname.slice(0, 18)}…`
          : pathname
        : '';

    return [host, pathShort].filter(Boolean).join(dot);
  }, [parsedUrl, isWikiLink, el]);

  const title = isReadOnly
    ? Node.string(el) ||
      (isWikiLink
        ? (el as any).wikiTitle || el.sitename || '문서'
        : displaySitename || el.url)
    : children;

  const icon = isWikiLink ? (
    wikiIcon ? (
      wikiIcon.startsWith('http') || wikiIcon.startsWith('/') ? (
        <SmartImage
          src={withVersion(cdn(wikiIcon))}
          alt=""
          width={22}
          height={22}
          style={{
            width: 22,
            height: 22,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {wikiIcon}
        </span>
      )
    ) : (
      <span
        style={{
          fontSize: 18,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        📄
      </span>
    )
  ) : externalFavicon ? (
    <img
      src={externalFavicon}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        objectFit: 'contain',
        display: 'block',
      }}
      contentEditable={false}
    />
  ) : (
    <ExternalLinkIcon size={18} />
  );

  const deleteButton = !isReadOnly ? (
    <button
      type="button"
      aria-label="링크 카드 삭제"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();

        const path = ReactEditor.findPath(editor, element);
        Transforms.removeNodes(editor, { at: path });
      }}
      style={{
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
      }}
      contentEditable={false}
      tabIndex={-1}
    >
      ×
    </button>
  ) : null;

  return (
    <LinkCardBlock
      mode={isReadOnly ? 'read' : 'edit'}
      href={el.url}
      title={title}
      subtitle={siteLabel}
      metaText={isReadOnly ? compactSubText : undefined}
      icon={icon}
      size={isSmall ? 'half' : 'normal'}
      inRow={inRow}
      isWikiLink={isWikiLink}
      attributes={attributes as any}
      editControls={deleteButton}
      clickableInReadMode={false}
    >
      {children}
    </LinkCardBlock>
  );
};

// -------------------- 하위 컴포넌트: 본문 이미지 --------------------
const ImageBlock: React.FC<BlockComponentProps<any>> = ({
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20h4.2L19.3 8.9a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0L4 15.8V20Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 6L18 10.2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const handleSaveSize = (width: number, height: number) => {
    const path = ReactEditor.findPath(editor, element);

    Transforms.setNodes(
      editor,
      { width, height },
      { at: path }
    );

    setModalOpen(false);
  };

  const imgSrc =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

  const openSizeModal = (e: React.MouseEvent<HTMLButtonElement>) => {
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
  };

  return (
    <>
      <MediaBlock
        mode="edit"
        kind="image"
        src={imgSrc}
        alt={el.alt || ''}
        textAlign={el.textAlign}
        width={el.width}
        height={el.height}
        selected={selected}
        focused={focused}
        attributes={attributes}
        imageRef={imgRef}
        editControls={
          selected ? (
            <button
              type="button"
              onMouseDown={openSizeModal}
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
              contentEditable={false}
            >
              <EditIcon />
            </button>
          ) : null
        }
      >
        {children}
      </MediaBlock>

      <ImageSizeModal
        open={modalOpen}
        width={initSize.w}
        height={initSize.h}
        onSave={handleSaveSize}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

// -------------------- 하위 컴포넌트: video --------------------
const VideoBlock: React.FC<BlockComponentProps<VideoElement>> = ({
  attributes,
  children,
  element,
  editor,
}) => {
  const el = element as VideoElement;
  const selected = useSelected();
  const focused = useFocused();

  const [modalOpen, setModalOpen] = useState(false);

  const handleSaveSize = (width: number, height: number) => {
    const path = ReactEditor.findPath(editor, element);

    Transforms.setNodes(
      editor,
      { width, height },
      { at: path }
    );

    setModalOpen(false);
  };

  const src =
    typeof el.url === 'string' && el.url.startsWith('http')
      ? toProxyUrl(el.url)
      : el.url;

  const openSizeModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <MediaBlock
        mode="edit"
        kind="video"
        src={src}
        textAlign={el.textAlign}
        width={el.width}
        height={el.height}
        selected={selected}
        focused={focused}
        attributes={attributes}
        editControls={
          selected ? (
            <button
              type="button"
              onMouseDown={openSizeModal}
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
              contentEditable={false}
            >
              ⚙️
            </button>
          ) : null
        }
      >
        {children}
      </MediaBlock>

      <ImageSizeModal
        open={modalOpen}
        width={el.width}
        height={el.height}
        onSave={handleSaveSize}
        onClose={() => setModalOpen(false)}
      />
    </>
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
      const el = element as
        | HeadingOneElement
        | HeadingTwoElement
        | HeadingThreeElement;

      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;

      return (
        <HeadingBlock
          mode="edit"
          level={level}
          textAlign={el.textAlign}
          icon={el.icon}
          attributes={attributes}
          onIconClick={() => onIconClick(el)}
        >
          {children}
        </HeadingBlock>
      );
    }

    // -------------------- 기본 문단 --------------------
    case 'paragraph': {
      const el = element as ParagraphElement;
      const indentLine = (el as any).indentLine;

      let extraClass = '';

      if (indentLine) {
        const path = ReactEditor.findPath(slateEditor, element);

        let isFirst = true;
        let isLast = true;

        try {
          const prevPath = Path.previous(path);
          const prevNode = Node.get(slateEditor, prevPath) as any;

          if (prevNode && prevNode.indentLine) {
            isFirst = false;
          }
        } catch {}

        try {
          const nextPath = Path.next(path);
          const nextNode = Node.get(slateEditor, nextPath) as any;

          if (nextNode && nextNode.indentLine) {
            isLast = false;
          }
        } catch {}

        if (isFirst) extraClass += ' start';
        if (isLast) extraClass += ' end';
      }

      return (
        <ParagraphBlock
          mode="edit"
          attributes={attributes}
          textAlign={(el as any).textAlign}
          indentLine={Boolean(indentLine)}
          indentClassName={extraClass}
        >
          {children}
        </ParagraphBlock>
      );
    }

    case 'divider': {
      const el = element as any;

      return (
        <DividerBlock
          mode="edit"
          styleType={el.style || 'default'}
          attributes={attributes as any}
        >
          {children}
        </DividerBlock>
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

      const noIcon = Boolean((element as any).noIcon);

      return (
        <InfoBoxBlock
          mode="edit"
          tone={raw}
          noIcon={noIcon}
          attributes={attributes}
        >
          {children}
        </InfoBoxBlock>
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
            flexWrap: 'wrap',
            gap: 12,
            width: '100%',
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
