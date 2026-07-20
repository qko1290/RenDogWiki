'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import LinkBlockRow from '@/components/wiki-render/blocks/LinkBlockRow';

type LinkBlockRowEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
};

export default function LinkBlockRowEditorAdapter({
  attributes,
  children,
}: LinkBlockRowEditorAdapterProps) {
  return (
    <LinkBlockRow attributes={attributes}>
      {children}
    </LinkBlockRow>
  );
}