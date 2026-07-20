'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import DividerBlock from '@/components/wiki-render/blocks/DividerBlock';
import InfoBoxBlock from '@/components/wiki-render/blocks/InfoBoxBlock';
import {
  resolveDividerStyle,
  resolveInfoBoxNoIcon,
  resolveInfoBoxTone,
} from '@/components/wiki-render/blocks/blockNodeUtils';

type EditorBlockAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: any;
};

export function DividerEditorAdapter({
  attributes,
  children,
  element,
}: EditorBlockAdapterProps) {
  return (
    <DividerBlock
      mode="edit"
      styleType={resolveDividerStyle(element)}
      attributes={attributes as any}
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
  return (
    <InfoBoxBlock
      mode="edit"
      tone={resolveInfoBoxTone(element)}
      noIcon={resolveInfoBoxNoIcon(element)}
      attributes={attributes}
    >
      {children}
    </InfoBoxBlock>
  );
}