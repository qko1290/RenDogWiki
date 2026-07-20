'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';
import { ReactEditor } from 'slate-react';
import type { Path } from 'slate';

import type { FootnoteElement } from '@/types/slate';
import { FootnoteInline } from '@/components/wiki-render/inline';

type FootnoteEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: FootnoteElement;
  editor: any;
  openFootnoteEditor?: (path: Path, element: FootnoteElement) => void;
};

export default function FootnoteEditorAdapter({
  attributes,
  children,
  element,
  editor,
  openFootnoteEditor,
}: FootnoteEditorAdapterProps) {
  return (
    <FootnoteInline
      mode="edit"
      label={element.label}
      attributes={attributes as React.HTMLAttributes<HTMLSpanElement>}
      title="우클릭하여 각주 수정"
      onContextMenu={(event) => {
        if (!openFootnoteEditor) return;

        event.preventDefault();
        event.stopPropagation();

        try {
          const path = ReactEditor.findPath(editor, element);

          openFootnoteEditor(path, element);
        } catch {}
      }}
    >
      {children}
    </FootnoteInline>
  );
}