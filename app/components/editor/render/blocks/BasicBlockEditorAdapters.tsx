'use client';

import React from 'react';
import {
  Editor,
  Node,
  Transforms,
} from 'slate';
import {
  ReactEditor,
  useSlateStatic,
} from 'slate-react';
import type {
  RenderElementProps,
} from 'slate-react';

import {
  DividerBlock,
  InfoBoxBlock,
} from '@/components/wiki-render';
import {
  getInfoBoxAlignmentPrefix,
  processInfoBoxLegacyIndentChunk,
} from '@/components/wiki-render/blocks/InfoBoxBlock';
import {
  resolveDividerStyle,
  resolveInfoBoxNoIcon,
  resolveInfoBoxTone,
} from '@/components/wiki-render/blocks/blockNodeUtils';

type EditorBlockAdapterProps = {
  attributes:
    RenderElementProps['attributes'];
  children: React.ReactNode;
  element: any;
};

function useNormalizeLegacyInfoBoxIndent(
  element: any,
) {
  const editor = useSlateStatic();

  const normalizedRef =
    React.useRef(false);

  React.useEffect(() => {
    if (normalizedRef.current) return;

    const plainText =
      Node.string(element);

    if (
      !getInfoBoxAlignmentPrefix(
        plainText,
      )
    ) {
      return;
    }

    normalizedRef.current = true;

    let elementPath: number[];

    try {
      elementPath =
        ReactEditor.findPath(
          editor,
          element,
        );
    } catch {
      return;
    }

    let afterLineBreak = false;

    const deletions: Array<{
      path: number[];
      start: number;
      end: number;
    }> = [];

    for (
      const [
        textNode,
        relativePath,
      ] of Node.texts(element)
    ) {
      const result =
        processInfoBoxLegacyIndentChunk(
          textNode.text,
          afterLineBreak,
        );

      afterLineBreak =
        result.afterLineBreak;

      for (
        const removal of
        result.removals
      ) {
        deletions.push({
          path: [
            ...elementPath,
            ...relativePath,
          ],
          start: removal.start,
          end: removal.end,
        });
      }
    }

    if (deletions.length === 0) {
      return;
    }

    Editor.withoutNormalizing(
      editor,
      () => {
        for (
          const deletion of
          deletions.reverse()
        ) {
          Transforms.delete(
            editor,
            {
              at: {
                anchor: {
                  path: deletion.path,
                  offset:
                    deletion.start,
                },
                focus: {
                  path: deletion.path,
                  offset:
                    deletion.end,
                },
              },
            },
          );
        }
      },
    );
  }, [
    editor,
    element,
  ]);
}

export function DividerEditorAdapter({
  attributes,
  children,
  element,
}: EditorBlockAdapterProps) {
  return (
    <DividerBlock
      mode="edit"
      styleType={
        resolveDividerStyle(element)
      }
      attributes={
        attributes as any
      }
    >
      {children}
    </DividerBlock>
  );
}

export function InfoBoxEditorAdapter({
  attributes,
  children,
  element,
}: EditorBlockAdapterProps) {
  useNormalizeLegacyInfoBoxIndent(
    element,
  );

  return (
    <InfoBoxBlock
      mode="edit"
      tone={
        resolveInfoBoxTone(element)
      }
      noIcon={
        resolveInfoBoxNoIcon(element)
      }
      plainText={
        Node.string(element)
      }
      attributes={attributes}
    >
      {children}
    </InfoBoxBlock>
  );
}
