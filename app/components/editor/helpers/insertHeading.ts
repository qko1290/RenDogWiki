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
  heading: 'heading-one' | 'heading-two' | 'heading-three'
) => {
  // 1. 커서(선택영역) 없으면 아무것도 하지 않음
  if (!editor.selection) return;

  // 2. 아이콘 입력 프롬프트(이후 모달 시스템으로 대체 예정)
  const icon = prompt('제목 앞에 표시할 이모지 또는 이미지 URL을 입력하세요') || '';

  // 3. 현재 블록을 heading + icon 타입으로 변환
  Transforms.setNodes(
    editor,
    { type: heading, icon } as Partial<HeadingElement>
  );

  // 4. heading 바로 뒤에 빈 단락(paragraph) 삽입
  // (heading 뒤에 커서 이동 가능하게 UX 개선)
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 5. 다음 블록 위치 계산(존재시 그 위치에 단락 삽입, 커서 이동)
  const nextPoint = Editor.after(editor, editor.selection.focus.path);
  if (nextPoint) {
    Transforms.insertNodes(editor, paragraph, { at: nextPoint });
    Transforms.select(editor, nextPoint);
  }
};
