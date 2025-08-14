// File: app/components/editor/helpers/insertDivider.ts
// =============================================
// 목적: 에디터에 구분선(divider) 블록을 삽입하고, 즉시 이어 쓸 수 있도록
//       뒤에 빈 단락(paragraph)을 함께 삽입한다.
// 사용처: 툴바/단축키에서 구분선 추가 액션
// - 선택 영역이 없을 때도 문서 끝에 안전하게 삽입
// - 두 노드 삽입을 한 덩어리로 처리하여 불필요한 중간 정규화 최소화
// =============================================

import { Editor, Transforms } from 'slate';
import type { DividerElement, ParagraphElement } from '@/types/slate';

/**
 * insertDivider
 * - 에디터 인스턴스(editor)에 divider(구분선)와 빈 단락을 차례대로 삽입한다.
 * @param editor Slate Editor 인스턴스
 * @param style  divider의 스타일 (기본값: "default")
 */
export const insertDivider = (
  editor: Editor,
  style: DividerElement['style'] = 'default'
): void => {
  // 1) 구분선(divider) 블록
  const divider: DividerElement = {
    type: 'divider',
    style,
    children: [{ text: '' }],
  };

  // 2) 뒤따를 빈 단락(paragraph) 블록
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 3) 삽입 위치: 커서가 없으면 문서 끝에 삽입
  const at = editor.selection ?? Editor.end(editor, []);

  // 4) 두 블록을 연속 삽입
  //    - withoutNormalizing으로 묶어 불필요한 중간 정규화/리렌더를 방지
  Editor.withoutNormalizing(editor, () => {
    Transforms.insertNodes(editor, [divider, paragraph], { at });
  });
};
