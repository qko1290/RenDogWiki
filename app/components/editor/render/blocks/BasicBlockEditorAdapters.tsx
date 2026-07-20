'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import DividerBlock from '@/components/wiki-render/blocks/DividerBlock';
import InfoBoxBlock from '@/components/wiki-render/blocks/InfoBoxBlock';

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
      styleType={element.style || 'default'}
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
  const tone =
    element.boxType ||
    element.variant ||
    element.tone ||
    element.infoType ||
    'note';

  const noIcon = Boolean(element.noIcon);

  return (
    <InfoBoxBlock
      mode="edit"
      tone={tone}
      noIcon={noIcon}
      attributes={attributes}
    >
      {children}
    </InfoBoxBlock>
  );
}