// components/editor/render/types.ts
import type React from 'react';
import type { RenderElementProps } from 'slate-react';
import type { Path } from 'slate';
import type { Element as SlateElement } from 'slate';
import type { CustomElement } from '@/types/slate';

export type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

/**
 * 공통 Renderer Props
 * - Slate가 요구하는 RenderElementProps 기반
 * - 추가 props는 모두 optional 로 만들어 충돌 제거
 */
export type CustomElementProps = {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

export type ElementRenderProps = RenderElementProps & CustomElementProps;
