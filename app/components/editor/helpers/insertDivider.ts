// =============================================
// File: app/components/editor/helpers/insertDivider.ts
// =============================================
/**
 * 에디터에 구분선(divider) 블록 삽입 유틸리티
 * - 현재 커서 위치에 divider(구분선) + 빈 단락(paragraph) 연속 삽입
 * - paragraph를 추가하는 이유: 커서가 divider 내부에 머무르지 않고, 다음 줄로 자동 이동하게 유도
 * - 추가하지 않으면 블럭 삽입 시 그 뒤에 커서를 놓을 수 없어요
 * - DividerElement/ParagraphElement 타입: @/types/slate.ts 에서 정의
 */

import { Editor, Transforms } from 'slate';
import type { DividerElement, ParagraphElement } from '@/types/slate';

/**
 * [divider 삽입 함수]
 * - 입력: 에디터 인스턴스(Editor)
 * - 동작: divider 블록 -> 빈 단락(paragraph) 순서로 삽입
 */
export const insertDivider = (editor: Editor, style: DividerElement["style"] = "default") => {
  // 1. 구분선(divider) 블록 객체 생성
  const divider: DividerElement = {
    type: 'divider',
    style,
    children: [{ text: '' }],
  };

  // 2. 빈 단락(paragraph) 블록 객체
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 3. 두 블록을 연속 삽입(커서가 divider 내에 남지 않도록 유도)
  // 주의: divider 단독 삽입시 커서가 divider에 머물러 예상치 못한 입력/포커스 문제 발생할 수 있음
  Transforms.insertNodes(editor, [divider, paragraph]);
};
