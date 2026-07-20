'use client';

import React from 'react';

import type {
  RenderElementProps,
} from 'slate-react';

import type {
  InlineImageElement,
  InlineMarkElement,
} from '@/types/slate';

import {
  InlineImage,
  InlineMark,
  WikiRefInline,
} from '@/components/wiki-render';
import {
  resolveInlineImageNode,
  resolveInlineMarkNode,
  resolveWikiRefNode,
} from '@/components/wiki-render/inline/inlineNodeUtils';
import type {
  WikiRefKind,
} from '@/components/wiki-render/types';

import { toProxyUrl } from '@lib/cdn';

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
  const {
    rawSrc,
    width,
    height,
  } = resolveInlineImageNode(element as any);

  const src = rawSrc.startsWith('http')
    ? toProxyUrl(rawSrc)
    : rawSrc;

  return (
    <InlineImage
      mode="edit"
      src={src}
      width={width}
      height={height}
      attributes={
        attributes as React.HTMLAttributes<HTMLSpanElement>
      }
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
  const {
    icon,
    color,
  } = resolveInlineMarkNode(element as any);

  return (
    <InlineMark
      mode="edit"
      icon={icon}
      color={color}
      attributes={
        attributes as React.HTMLAttributes<HTMLSpanElement>
      }
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
  onWikiRefClick?: (
    kind: WikiRefKind,
    id: number,
  ) => void;
  onOpenWikiRef?: (
    kind: WikiRefKind,
    id: number,
  ) => void;
};

export function WikiRefEditorAdapter({
  attributes,
  children,
  element,
  readOnly,
  onWikiRefClick,
  onOpenWikiRef,
}: WikiRefEditorAdapterProps) {
  const {
    kind,
    id: refId,
  } = resolveWikiRefNode(element);

  const open =
    onWikiRefClick ?? onOpenWikiRef;

  return (
    <WikiRefInline
      mode="edit"
      attributes={
        attributes as React.HTMLAttributes<HTMLSpanElement>
      }
      contentEditable={!readOnly}
      clickable={Boolean(
        readOnly &&
        open &&
        Number.isFinite(refId),
      )}
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