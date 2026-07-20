'use client';

import React from 'react';
import type { RenderElementProps } from 'slate-react';

import type { WeaponCardElement } from '@/types/slate';

import WeaponEditorAdapter from './weapon/WeaponEditorAdapter';

export interface WeaponCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: WeaponCardElement;
  editor: any;
}

export function WeaponCard({
  attributes,
  children,
  element,
  editor,
}: WeaponCardProps) {
  return (
    <WeaponEditorAdapter
      attributes={attributes}
      element={element}
      editor={editor}
    >
      {children}
    </WeaponEditorAdapter>
  );
}

export default WeaponCard;