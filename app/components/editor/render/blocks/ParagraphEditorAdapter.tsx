'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';
import { ReactEditor } from 'slate-react';
import { Node, Path } from 'slate';

import type { ParagraphElement } from '@/types/slate';
import ParagraphBlock from '@/components/wiki-render/blocks/ParagraphBlock';

type ParagraphEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: ParagraphElement;
  editor: any;
};

export default function ParagraphEditorAdapter({
  attributes,
  children,
  element,
  editor,
}: ParagraphEditorAdapterProps) {
  const indentLine = (element as any).indentLine;
  let extraClass = '';

  if (indentLine) {
    const path = ReactEditor.findPath(editor, element);
    let isFirst = true;
    let isLast = true;

    try {
      const prevPath = Path.previous(path);
      const prevNode = Node.get(editor, prevPath) as any;

      if (prevNode && prevNode.indentLine) {
        isFirst = false;
      }
    } catch {}

    try {
      const nextPath = Path.next(path);
      const nextNode = Node.get(editor, nextPath) as any;

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
      textAlign={(element as any).textAlign}
      indentLine={Boolean(indentLine)}
      indentClassName={extraClass.trim()}
    >
      {children}
    </ParagraphBlock>
  );
}