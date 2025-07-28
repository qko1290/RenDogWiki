// =============================================
// File: app/components/editor/helpers/insertDivider.ts
// =============================================
/**
 * 에디터에 구분선(divider) 블록을 삽입하는 유틸리티 함수.
 * - 현재 커서 위치에 divider 블록과 그 뒤에 빈 단락(paragraph) 블록을 연속 삽입한다.
 * - paragraph를 함께 추가하는 이유는, 커서가 divider 내에 머무르지 않고 다음 줄로 자동 이동하게 하기 위함.
 *   (divider만 단독 삽입하면, 사용자가 그 뒤에 내용을 바로 입력할 수 없기 때문)
 * - DividerElement/ParagraphElement 타입은 @/types/slate.ts에서 정의됨.
 */

import { Editor, Transforms } from 'slate';
import type { DividerElement, ParagraphElement } from '@/types/slate';

/**
 * insertDivider
 * - 에디터 인스턴스(editor)에 divider(구분선)와 빈 단락을 차례대로 삽입한다.
 * @param editor Slate Editor 인스턴스
 * @param style divider의 스타일 (기본값: "default")
 */
export const insertDivider = (
  editor: Editor,
  style: DividerElement["style"] = "default"
) => {
  // 1. 구분선(divider) 블록 생성
  const divider: DividerElement = {
    type: 'divider',
    style,
    children: [{ text: '' }],
  };

  // 2. 뒤따를 빈 단락(paragraph) 블록 생성
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 3. 두 블록을 연속 삽입
  //    (이렇게 해야 커서가 divider에 머물지 않고, 다음 줄로 이동함)
  Transforms.insertNodes(editor, [divider, paragraph]);
};
