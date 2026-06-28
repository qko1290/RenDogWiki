'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

type LinkBlockRowEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
};

export default function LinkBlockRowEditorAdapter({
  attributes,
  children,
}: LinkBlockRowEditorAdapterProps) {
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