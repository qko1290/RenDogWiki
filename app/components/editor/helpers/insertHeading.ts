// File: app/components/editor/helpers/insertHeading.ts

/**
 * 슬레이트(Slate.js) 에디터에 제목(heading) 삽입 유틸
 * - 현재 커서 위치의 블록을 heading으로 변환
 * - 변환 후 다음 위치에 빈 단락(paragraph) 자동 삽입(제목 다음에 커서를 놓을 수 없는 현상 방지)
 */

import { Editor, Transforms } from 'slate';
import type { ParagraphElement, CustomText } from '@/types/slate';

// Heading 타입
export type HeadingElement = {
  type: 'heading-one' | 'heading-two' | 'heading-three';
  icon?: string;
  children: CustomText[];
};

export const insertHeading = (
  editor: Editor,
  heading: 'heading-one' | 'heading-two' | 'heading-three'
) => {
  // 커서 미선택 상태면 무시
  if (!editor.selection) return;

  // 사용자에게 아이콘 입력 프롬프트를 띄움(이후 모달 시스템으로 대체할 예정이에요)
  const icon = prompt('제목 앞에 표시할 이모지 또는 이미지 URL을 입력하세요') || '';

  // 현재 블록을 heading+icon으로 변환
  Transforms.setNodes(
    editor,
    { type: heading, icon } as Partial<HeadingElement>
  );

  // heading 뒤에 자동으로 빈 단락 삽입
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 다음 블록 위치 계산, 존재시 그 자리에 단락 삽입/선택
  const nextPoint = Editor.after(editor, editor.selection.focus.path);
  if (nextPoint) {
    Transforms.insertNodes(editor, paragraph, { at: nextPoint });
    Transforms.select(editor, nextPoint);
  }
};
