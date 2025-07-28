// =============================================
// File: app/components/editor/helpers/insertHeading.ts
// =============================================
/**
 * 에디터에서 현재 커서 위치의 블록을 heading(제목) 블록으로 변환하고,
 * heading 바로 뒤에 빈 단락(paragraph)을 자동으로 삽입해주는 유틸리티 함수.
 * - heading-one, heading-two, heading-three 중 원하는 타입으로 변환
 * - heading 앞에 아이콘(이모지/이미지)도 부여 가능
 * - heading 뒤에 자동으로 빈 단락이 따라붙으므로, 사용자 입력 흐름이 끊기지 않음
 *   (heading만 있으면 그 다음에 커서가 제대로 이동하지 않아 바로 입력이 불가능한 Slate 특성 대응)
 */

import { Editor, Transforms } from 'slate';
import type { ParagraphElement, CustomText } from '@/types/slate';

// HeadingElement 타입 선언
export type HeadingElement = {
  type: 'heading-one' | 'heading-two' | 'heading-three';
  icon?: string;                // heading 앞에 붙는 아이콘(이모지/이미지)
  children: CustomText[];       // Slate 텍스트 노드
};

/**
 * insertHeading
 * - 에디터에서 현재 커서 위치 블록을 heading으로 변환, heading 뒤에 빈 단락 삽입
 * @param editor Slate Editor 인스턴스
 * @param heading 'heading-one' | 'heading-two' | 'heading-three'
 * @param icon (옵션) 아이콘(이모지/이미지 URL)
 */
export const insertHeading = (
  editor: Editor,
  heading: 'heading-one' | 'heading-two' | 'heading-three',
  icon: string = ''
) => {
  // 1. 선택된 영역(커서)이 없으면 동작 안 함
  if (!editor.selection) return;

  // 2. 현재 블록을 heading 타입 + 아이콘으로 변환
  Transforms.setNodes(
    editor,
    { type: heading, icon } as Partial<HeadingElement>
  );

  // 3. heading 바로 뒤에 빈 단락(paragraph) 추가
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 4. 커서가 있는 위치의 "다음"에 빈 단락 삽입
  //    (heading 뒤에 바로 입력 가능하도록)
  const nextPoint = Editor.after(editor, editor.selection.focus.path);
  if (nextPoint) {
    Transforms.insertNodes(editor, paragraph, { at: nextPoint });
    Transforms.select(editor, nextPoint);
  }
};
