'use client';

import React from 'react';
import { ReactEditor } from 'slate-react';
import { Editor, Element as SlateElement } from 'slate';

export function usePriceTableBlockGuard(editor: any) {
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { selection } = editor;

      if (!selection || !ReactEditor.isFocused(editor)) return;

      const [node] = Editor.node(editor, selection, { depth: 1 });

      if (
        SlateElement.isElement(node) &&
        (node as any).type === 'price-table-card' &&
        event.key === 'Backspace'
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handler, true);

    return () => {
      window.removeEventListener('keydown', handler, true);
    };
  }, [editor]);
}