/**
 * 블록 미디어(이미지/영상) 정렬(alignment) 설정 유틸리티
 * - 선택된 이미지/영상 블록의 textAlign을 left/center/right/justify로 변경
 * - 선택된 블록이 없으면 아무 것도 하지 않음
 */

import { Editor, Transforms, Element as SlateElement } from 'slate';

type Align = 'left' | 'center' | 'right' | 'justify';

/**
 * [정렬 변경]
 * - editor: Slate 에디터 인스턴스
 * - alignment: 'left' | 'center' | 'right' | 'justify'
 */
export function setImageAlignment(editor: Editor, alignment: Align) {
  if (!editor.selection) return;

  const [entry] = Editor.nodes(editor, {
    match: n =>
      SlateElement.isElement(n) &&
      ((n as any).type === 'image' || (n as any).type === 'video'),
    mode: 'lowest',
  });
  if (!entry) return;

  const [node, path] = entry as [any, any];

  if (node?.textAlign === alignment) return;

  Transforms.setNodes(editor, { textAlign: alignment } as Partial<typeof node>, { at: path });
}
