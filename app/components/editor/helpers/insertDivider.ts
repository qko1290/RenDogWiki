// File: app/components/editor/helpers/insertDivider.ts

/**
 * 에디터에 구분선(divider) 삽입 유틸
 * - 현재 커서 위치에 구분선(divider) 블록 + 빈 단락(paragraph) 삽입
 * - 에디터에서 "구분선" 버튼 클릭 시 호출
 * - paragraph 추가는 사용자 커서가 divider 내부에 머무르지 않도록 하기 위함
 */

import { Editor, Transforms } from 'slate';
import type { DividerElement, ParagraphElement } from '@/types/slate';

export const insertDivider = (editor: Editor) => {
  // 구분선 블록 객체
  const divider: DividerElement = {
    type: 'divider',
    children: [{ text: '' }],
  };

  // 빈 단락(구분선 바로 아래 커서 이동 유도)
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 두 블록을 연속 삽입(divider 내 커서 방지)
  Transforms.insertNodes(editor, [divider, paragraph]);
};
