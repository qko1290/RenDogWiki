'use client';

import React from 'react';

import {
  InlineImage,
  InlineMark,
  WikiRefInline,
} from '@/components/wiki-render/inline';

import { cdn, withVersion } from '@lib/cdn';
import type { WikiRefKind } from '@/components/editor/render/types';
import type { WikiRefHandlers } from './types';

export function InlineImageReadAdapter({ node }: { node: any }) {
  const rawSrc = String(node.url ?? node.src ?? '').trim();
  const version = (node.updatedAt || node.version) as string | number | undefined;
  const src = rawSrc ? withVersion(cdn(rawSrc), version) : '';

  const hasExplicitWidth =
    node.width != null && Number.isFinite(Number(node.width));

  const hasExplicitHeight =
    node.height != null && Number.isFinite(Number(node.height));

  return (
    <InlineImage
      mode="read"
      src={src}
      width={hasExplicitWidth ? Number(node.width) : undefined}
      height={hasExplicitHeight ? Number(node.height) : undefined}
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
  return (
    <InlineMark
      mode="read"
      icon={node.icon}
      color={node.color}
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
  const kind = (node.kind ?? node.refType) as WikiRefKind;
  const id = Number(node.id ?? node.refId);

  const clickable =
    !!handlers?.onWikiRefClick &&
    (handlers?.readOnly ?? true) &&
    Number.isFinite(id) &&
    id > 0;

  return (
    <WikiRefInline
      mode="read"
      clickable={clickable}
      onOpen={() => {
        if (!clickable) return;

        handlers!.onWikiRefClick!(kind, id);
      }}
    >
      {children}
    </WikiRefInline>
  );
}