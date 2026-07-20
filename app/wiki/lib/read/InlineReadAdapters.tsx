'use client';

import React from 'react';

import {
  InlineImage,
  InlineMark,
  WikiRefInline,
} from '@/components/wiki-render/inline';
import {
  resolveInlineImageNode,
  resolveInlineMarkNode,
  resolveWikiRefNode,
} from '@/components/wiki-render/inline/inlineNodeUtils';

import {
  cdn,
  withVersion,
} from '@lib/cdn';

import type {
  WikiRefHandlers,
} from './types';

export function InlineImageReadAdapter({
  node,
}: {
  node: any;
}) {
  const {
    rawSrc,
    width,
    height,
    version,
  } = resolveInlineImageNode(node);

  const src = rawSrc
    ? withVersion(cdn(rawSrc), version)
    : '';

  return (
    <InlineImage
      mode="read"
      src={src}
      width={width}
      height={height}
    />
  );
}

export function InlineMarkReadAdapter({
  node,
  children,
}: {
  node: any;
  children: React.ReactNode;
}) {
  const {
    icon,
    color,
  } = resolveInlineMarkNode(node);

  return (
    <InlineMark
      mode="read"
      icon={icon}
      color={color}
    >
      {children}
    </InlineMark>
  );
}

export function WikiRefReadAdapter({
  node,
  handlers,
  children,
}: {
  node: any;
  handlers?: WikiRefHandlers;
  children: React.ReactNode;
}) {
  const {
    kind,
    id,
  } = resolveWikiRefNode(node);

  const clickable =
    Boolean(handlers?.onWikiRefClick) &&
    (handlers?.readOnly ?? true) &&
    Number.isFinite(id) &&
    id > 0;

  return (
    <WikiRefInline
      mode="read"
      clickable={clickable}
      onOpen={() => {
        if (!clickable) return;

        handlers!.onWikiRefClick!(
          kind,
          id,
        );
      }}
    >
      {children}
    </WikiRefInline>
  );
}