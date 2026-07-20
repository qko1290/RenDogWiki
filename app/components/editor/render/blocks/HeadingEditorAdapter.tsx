'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import type {
  CustomElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
} from '@/types/slate';

import HeadingBlock from '@/components/wiki-render/blocks/HeadingBlock';

type HeadingElement =
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement;

type HeadingEditorAdapterProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: HeadingElement;
  onIconClick: (element: CustomElement) => void;
};

function getHeadingLevel(element: HeadingElement): 1 | 2 | 3 {
  if (element.type === 'heading-one') return 1;
  if (element.type === 'heading-two') return 2;
  return 3;
}

export default function HeadingEditorAdapter({
  attributes,
  children,
  element,
  onIconClick,
}: HeadingEditorAdapterProps) {
  return (
    <HeadingBlock
      mode="edit"
      level={getHeadingLevel(element)}
      textAlign={element.textAlign}
      icon={element.icon}
      attributes={attributes}
      onIconClick={() => onIconClick(element as unknown as CustomElement)}
    >
      {children}
    </HeadingBlock>
  );
}