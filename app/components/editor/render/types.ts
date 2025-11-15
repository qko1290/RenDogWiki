// components/editor/render/types.ts
import type React from 'react';
import type { RenderElementProps } from 'slate-react';
import type { Path } from 'slate';
import type { CustomElement } from '@/types/slate';

export type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

export type ElementRenderProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};
