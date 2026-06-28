'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import type {
  InlineImageElement,
  InlineMarkElement,
} from '@/types/slate';

import {
  InlineImage,
  InlineMark,
  WikiRefInline,
} from '@/components/wiki-render/inline';

import { toProxyUrl } from '@lib/cdn';
import type { WikiRefKind } from '../types';

type InlineAdapterProps<E> = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: E;
};

export function InlineImageEditorAdapter({
  attributes,
  children,
  element,
}: InlineAdapterProps<InlineImageElement>) {
  const src = element.url?.startsWith('http')
    ? toProxyUrl(element.url)
    : element.url;

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

export function InlineMarkEditorAdapter({
  attributes,
  children,
  element,
}: InlineAdapterProps<InlineMarkElement>) {
  return (
    <InlineMark
      mode="edit"
      icon={element.icon}
      color={element.color}
      attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
    >
      {children}
    </InlineMark>
  );
}

type WikiRefEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: any;
  readOnly?: boolean;
  onWikiRefClick?: (kind: WikiRefKind, id: number) => void;
  onOpenWikiRef?: (kind: WikiRefKind, id: number) => void;
};

export function WikiRefEditorAdapter({
  attributes,
  children,
  element,
  readOnly,
  onWikiRefClick,
  onOpenWikiRef,
}: WikiRefEditorAdapterProps) {
  const kind = element.kind as WikiRefKind;
  const refId = Number(element.id);
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