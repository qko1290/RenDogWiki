// File: app/components/editor/helpers/insertHeading.ts
// =============================================
// 목적: 현재 커서가 있는 블록을 heading(one/two/three)으로 바꾸고,
//       그 바로 뒤에 빈 단락을 삽입해 사용자 입력 흐름을 끊지 않게 한다.
// 사용처: 에디터 툴바/단축키의 "제목" 전환 액션
// - 블록 단위로 정확히 변환
// - 새 단락 삽입 후 커서를 해당 단락 앞으로 이동
// - setNodes/insertNodes 제네릭 명시로 타입 오류 방지
// =============================================

import { Editor, Transforms, Path, Element as SlateElement } from 'slate';
import type { ParagraphElement, CustomText } from '@/types/slate';

// HeadingElement 타입 선언
export type HeadingElement = {
  type: 'heading-one' | 'heading-two' | 'heading-three';
  icon?: string;          // heading 앞에 붙는 아이콘(이모지/이미지)
  children: CustomText[]; // Slate 텍스트 노드
};

/**
 * insertHeading
 * - 에디터에서 현재 커서 위치 블록을 heading으로 변환, heading 뒤에 빈 단락 삽입
 * @param editor  Slate Editor 인스턴스
 * @param heading 'heading-one' | 'heading-two' | 'heading-three'
 * @param icon    (옵션) 아이콘(이모지/이미지 URL). 기본값: 빈 문자열(기존 아이콘 초기화)
 */
export const insertHeading = (
  editor: Editor,
  heading: 'heading-one' | 'heading-two' | 'heading-three',
  icon: string = ''
): void => {
  // 선택(커서)이 없으면 동작하지 않음
  if (!editor.selection) return;

  // 커서가 속한 블록 엔트리 획득
  const entry = Editor.above(editor, { match: n => SlateElement.isElement(n) });
  if (!entry) return;
  const [, blockPath] = entry;

  // heading 뒤에 붙일 빈 단락
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  // 중간 정규화 최소화
  Editor.withoutNormalizing(editor, () => {
    // 현재 블록을 heading 타입(+ 아이콘)으로 변환
    Transforms.setNodes<HeadingElement>(
      editor,
      { type: heading, icon } as Partial<HeadingElement>,
      { match: n => SlateElement.isElement(n) }
    );

    // 변환한 블록 "다음 경로"에 빈 단락 삽입
    const insertPath = Path.next(blockPath);
    Transforms.insertNodes<ParagraphElement>(editor, paragraph, { at: insertPath });

    // 커서를 새 단락의 시작으로 이동(바로 입력 가능)
    const startOfNew = Editor.start(editor, insertPath);
    Transforms.select(editor, startOfNew);
  });
};
