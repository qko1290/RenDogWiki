// =============================================
// File: app/components/editor/helpers/insertHeading.ts
// =============================================
/**
 * 에디터에 제목(heading) 삽입 유틸리티
 * - 현재 커서 위치의 블록을 heading-one/two/three로 변환
 * - 변환 시 사용자에게 아이콘(이모지/이미지 URL) 입력 프롬프트 표시(추후 모달 대체)
 * - heading 블록 뒤에 자동으로 빈 단락(paragraph) 삽입(heading 바로 뒤에 입력 불가 이슈 방지)
 */

import { Editor, Transforms } from 'slate';
import type { ParagraphElement, CustomText } from '@/types/slate';

// HeadingElement 타입 선언
export type HeadingElement = {
  type: 'heading-one' | 'heading-two' | 'heading-three';
  icon?: string;                // heading 앞 아이콘
  children: CustomText[];       // Slate 텍스트 노드
};

/**
 * [heading 삽입 함수]
 * - 입력: editor(에디터 인스턴스), heading 타입명(문자열)
 * - 동작:
 *   1. 커서 미선택시 즉시 종료
 *   2. 사용자가 아이콘 입력
 *   3. 현재 블록을 heading + icon으로 변환
 *   4. heading 뒤에 빈 단락 삽입, 커서 이동
 */
export const insertHeading = (
  editor: Editor,
  heading: 'heading-one' | 'heading-two' | 'heading-three',
  icon: string = ''
) => {
  if (!editor.selection) return;

  // (icon 인자 받음)
  Transforms.setNodes(
    editor,
    { type: heading, icon } as Partial<HeadingElement>
  );

  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  const nextPoint = Editor.after(editor, editor.selection.focus.path);
  if (nextPoint) {
    Transforms.insertNodes(editor, paragraph, { at: nextPoint });
    Transforms.select(editor, nextPoint);
  }
};
