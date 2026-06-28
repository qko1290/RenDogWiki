'use client';

import React, { useRef, useState, useMemo } from 'react';
import {
  RenderElementProps,
  ReactEditor,
  useSelected,
  useFocused,
  useSlate,
} from 'slate-react';
import { Node, Transforms, Path, Element as SlateElement } from 'slate';

import ImageSizeModal from './ImageSizeModal';
import { toProxyUrl } from '@lib/cdn';

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
import LinkCardRenderer from '@/components/wiki-render/link/LinkCardRenderer';
import {
  FootnoteInline,
  InlineImage,
  InlineMark,
  WikiRefInline,
} from '@/components/wiki-render/inline';
import InlineLinkRenderer from '@/components/wiki-render/link/InlineLinkRenderer';

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

function getParsedUrl(url?: string | null) {
  if (!url) return null;

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    return new URL(url, base);
  } catch {
    return null;
  }
}

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

const LinkBlockView: React.FC<BlockComponentProps<LinkBlockElement>> = ({
  attributes,
  children,
  element,
  editor,
}) => {
  const el = element;
  const isReadOnly = ReactEditor.isReadOnly(editor);

  const parsedUrl = useMemo(() => getParsedUrl(el.url), [el.url]);

  const isWikiLink = useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [el.isWiki, parsedUrl]);

  let displaySitename = el.sitename;

  if (!isWikiLink && !displaySitename && parsedUrl) {
    displaySitename = parsedUrl.hostname.replace(/^www\./, '');
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
      /path\s*=|title\s*=|#heading-|https?:\/\/|\/wiki|[?&]=|%[0-9A-Fa-f]{2}/.test(
        s,
      );

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
    <LinkCardRenderer
      mode={isReadOnly ? 'read' : 'edit'}
      url={el.url}
      isWiki={el.isWiki}
      wikiPath={(el as any).wikiPath}
      wikiTitle={(el as any).wikiTitle}
      sitename={el.sitename}
      size={el.size}
      docIcon={(el as any).docIcon}
      labelText={
        isReadOnly
          ? Node.string(el) ||
            (isWikiLink
              ? (el as any).wikiTitle || el.sitename || '문서'
              : displaySitename || el.url || '링크')
          : undefined
      }
      titleContent={title}
      subtitle={siteLabel}
      metaText={isReadOnly ? compactSubText : undefined}
      inRow={inRow}
      attributes={attributes as any}
      editControls={deleteButton}
      clickableInReadMode={false}
    >
      {children}
    </LinkCardRenderer>
  );
};

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

    Transforms.setNodes(editor, { width, height }, { at: path });
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

    Transforms.setNodes(editor, { width, height }, { at: path });
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
    case 'link': {
      return (
        <InlineLinkRenderer
          mode="edit"
          href={(element as any).url}
          attributes={attributes as React.AnchorHTMLAttributes<HTMLAnchorElement>}
        >
          {children}
        </InlineLinkRenderer>
      );
    }

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

    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as
        | HeadingOneElement
        | HeadingTwoElement
        | HeadingThreeElement;
      const level =
        el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;

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
          attributes={attributes as any}
          textAlign={(el as any).textAlign}
          indentLine={Boolean(indentLine)}
          indentClassName={extraClass.trim()}
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

    case 'image': {
      return (
        <ImageBlock attributes={attributes} element={element as any} editor={editor}>
          {children}
        </ImageBlock>
      );
    }

    case 'inline-image': {
      const el = element as InlineImageElement;
      const src = el.url?.startsWith('http') ? toProxyUrl(el.url) : el.url;

      return (
        <InlineImage
          mode="edit"
          src={src}
          attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
        >
          {children}
        </InlineImage>
      );
    }

    case 'inline-mark': {
      const el = element as InlineMarkElement;

      return (
        <InlineMark
          mode="edit"
          icon={el.icon}
          color={el.color}
          attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
        >
          {children}
        </InlineMark>
      );
    }

    case 'footnote': {
      const el = element as FootnoteElement;

      return (
        <FootnoteInline
          mode="edit"
          label={el.label}
          attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
          title="우클릭하여 각주 수정"
          onContextMenu={(e) => {
            if (!openFootnoteEditor) return;

            e.preventDefault();
            e.stopPropagation();

            try {
              const path = ReactEditor.findPath(slateEditor, element);

              openFootnoteEditor(path, el);
            } catch {}
          }}
        >
          {children}
        </FootnoteInline>
      );
    }

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
        <TableRowRenderer attributes={attributes} element={element as any}>
          {children}
        </TableRowRenderer>
      );
    }

    case 'table-cell': {
      return (
        <TableCellRenderer
          attributes={attributes}
          element={element as any}
          editor={editor}
        >
          {children}
        </TableCellRenderer>
      );
    }

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
      const label =
        t === 'quest-embed' ? '퀘스트' : t === 'npc-embed' ? 'NPC' : 'QNA';

      return (
        <div
          {...attributes}
          contentEditable={false}
          style={{
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 12,
            margin: '12px 0',
            background: '#f8fafc',
          }}
        >
          <strong>{label} 삽입</strong>
          <div>ID: {String(id ?? '-')}</div>
          <div>나중에 id로 데이터 로드</div>
          {children}
        </div>
      );
    }

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
        <WikiRefInline
          mode="edit"
          attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
          contentEditable={!readOnly}
          clickable={Boolean(readOnly && open && Number.isFinite(refId))}
          onOpen={() => {
            if (!readOnly) return;
            if (!open) return;

            open(kind, refId);
          }}
        >
          {children}
        </WikiRefInline>
      );
    }

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
        {
          ...attributes,
          style: { textAlign },
        },
        children,
      );
    }
  }
};

export default Element;
