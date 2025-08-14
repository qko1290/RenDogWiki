// =============================================
// File: app/components/editor/helpers/setImageAlignment.ts
// =============================================
/**
 * 에디터에서 이미지 블록의 정렬(alignment) 설정 유틸리티
 * - 선택된 이미지 블록의 textAlign 속성을 left/center/right/justify로 변경
 * - 이미지가 선택된 상태에서만 동작(없으면 아무것도 안 함)
 */

import { Editor, Transforms, Element as SlateElement } from 'slate';

type Align = 'left' | 'center' | 'right' | 'justify';

/**
 * [이미지 정렬 변경 함수]
 * - editor: Slate 에디터 인스턴스
 * - alignment: 'left' | 'center' | 'right' | 'justify'
 * - 현재 선택된 이미지 블록만 정렬 값 변경
 */
export function setImageAlignment(editor: Editor, alignment: Align) {
  if (!editor.selection) return;

  const [imageEntry] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && (n as any).type === 'image',
    mode: 'lowest', // 가장 가까운 image 블록만 타겟
  });
  if (!imageEntry) return;

  const [node, path] = imageEntry as [any, any];

  // 불필요한 업데이트 방지: 이미 같은 값이면 skip
  if (node?.textAlign === alignment) return;

  // textAlign 속성만 변경(다른 속성은 그대로 유지)
  Transforms.setNodes(editor, { textAlign: alignment } as Partial<typeof node>, { at: path });
}
