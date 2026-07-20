'use client';

import React, { useMemo } from 'react';
import { Node, Transforms, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';
import type { RenderElementProps } from 'slate-react';

import type { LinkBlockElement } from '@/types/slate';

import LinkCardRenderer from '@/components/wiki-render/link/LinkCardRenderer';
import {
  isRdwikiWikiUrl,
  parseLinkUrl,
} from '@/components/wiki-render/link/linkUtils';
import useResolvedWikiDocIcon from '@/components/wiki-render/link/useResolvedWikiDocIcon';

type LinkBlockEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: LinkBlockElement;
  editor: any;
};

function isGarbageSiteName(value: string) {
  return (
    !value ||
    /path\s*=|title\s*=|#heading-|https?:\/\/|\/wiki|[?&]=|%[0-9A-Fa-f]{2}/.test(
      value,
    )
  );
}

function getCompactSubText({
  parsedUrl,
  isWikiLink,
  element,
}: {
  parsedUrl: URL | null;
  isWikiLink: boolean;
  element: LinkBlockElement;
}) {
  if (!parsedUrl) return '';

  const dot = ' · ';
  const parts: string[] = [];

  if (isWikiLink) {
    const path =
      parsedUrl.searchParams.get('path') ??
      ((element as any).wikiPath != null
        ? String((element as any).wikiPath)
        : null);

    const title =
      parsedUrl.searchParams.get('title') ??
      ((element as any).wikiTitle != null
        ? String((element as any).wikiTitle)
        : null);

    if (path) parts.push(`path=${path}`);
    if (title) parts.push(`title=${title}`);

    const rawHash = parsedUrl.hash
      ? parsedUrl.hash.slice(1)
      : '';

    const decodedHash = rawHash
      ? (() => {
          try {
            return decodeURIComponent(rawHash);
          } catch {
            return rawHash;
          }
        })()
      : '';

    if (decodedHash) {
      const cleanHash = decodedHash.startsWith('heading-')
        ? decodedHash.slice(8)
        : decodedHash;

      const shortHash =
        cleanHash.length > 26
          ? `${cleanHash.slice(0, 26)}…`
          : cleanHash;

      parts.push(`#${shortHash}`);
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
}

export default function LinkBlockEditorAdapter({
  attributes,
  children,
  element,
  editor,
}: LinkBlockEditorAdapterProps) {
  const el = element;
  const isReadOnly = ReactEditor.isReadOnly(editor);

  const parsedUrl = useMemo(
    () => parseLinkUrl(el.url),
    [el.url],
  );

  const isWikiLink = useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [el.isWiki, parsedUrl]);

  const resolvedDocIcon = useResolvedWikiDocIcon({
    href: el.url,
    isWikiLink,
    fallbackIcon: (el as any).docIcon,
  });

  let displaySitename = el.sitename;

  if (!isWikiLink && !displaySitename && parsedUrl) {
    displaySitename = parsedUrl.hostname.replace(/^www\./, '');
  }

  let inRow = false;

  try {
    const path = ReactEditor.findPath(editor, element);
    const parent = Node.parent(editor as any, path);

    inRow =
      SlateElement.isElement(parent) &&
      (parent as any).type === 'link-block-row';
  } catch {}

  const siteLabel = useMemo(() => {
    const clean = (value?: string | null) =>
      (value ?? '').trim();

    if (isWikiLink) return 'RenDog Wiki';

    const siteName = clean(el.sitename);

    if (siteName && !isGarbageSiteName(siteName)) {
      return siteName;
    }

    if (parsedUrl) {
      return parsedUrl.hostname.replace(/^www\./, '');
    }

    return '';
  }, [isWikiLink, parsedUrl, el.sitename]);

  const compactSubText = useMemo(
    () =>
      getCompactSubText({
        parsedUrl,
        isWikiLink,
        element: el,
      }),
    [parsedUrl, isWikiLink, el],
  );

  const title = isReadOnly
    ? Node.string(el) ||
      (isWikiLink
        ? (el as any).wikiTitle ||
          el.sitename ||
          '문서'
        : displaySitename || el.url)
    : children;

  const deleteButton = !isReadOnly ? (
    <button
      type="button"
      aria-label="링크 카드 삭제"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();

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
      docIcon={resolvedDocIcon}
      labelText={
        isReadOnly
          ? Node.string(el) ||
            (isWikiLink
              ? (el as any).wikiTitle ||
                el.sitename ||
                '문서'
              : displaySitename ||
                el.url ||
                '링크')
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
}