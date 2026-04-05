// components/editor/render/types.ts
import type React from 'react';
import type { RenderElementProps } from 'slate-react';
import type { Path } from 'slate';
import type { CustomElement, FootnoteElement } from '@/types/slate';

export type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

export type WikiRefKind = 'quest' | 'npc' | 'qna';

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
  openFootnoteEditor?: (path: Path, element: FootnoteElement) => void;

  // ✅ 문서(읽기) 전용 클릭 → 모달 오픈
  readOnly?: boolean;

  // ✅ 최종으로 쓸 이름
  onWikiRefClick?: (kind: WikiRefKind, id: number) => void | Promise<void>;

  // ✅ (기존/혼재 코드 호환용) 예전 이름도 받음
  onOpenWikiRef?: (kind: WikiRefKind, id: number) => void | Promise<void>;
};

export type ElementRenderProps = RenderElementProps & CustomElementProps;
