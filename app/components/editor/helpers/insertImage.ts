// File: app/components/editor/helpers/insertImage.ts
// =============================================
// insertImage
// - 현재 커서 위치에 이미지 블록(image node)을 삽입하고
//   그 바로 다음에 빈 단락(paragraph)을 추가해 커서가 곧바로 이어질 수 있게 한다.
// - 삽입 후 커서를 새 단락 시작 지점으로 이동하고, 에디터 포커스를 명확히 준다.
// 사용처: 에디터 툴바/컨텍스트 메뉴의 "이미지" 삽입 액션
// =============================================

import { Editor, Transforms, Range, Element as SlateElement, Path } from 'slate';
import { ReactEditor } from 'slate-react';
import type { ImageElement, ParagraphElement } from '@/types/slate';

/**
 * insertImage
 * @param editor Slate Editor 인스턴스
 * @param url    삽입할 이미지 URL
 */
export function insertImage(editor: Editor, url: string) {
  // 1) 이미지 노드 생성 (children에는 빈 텍스트 노드가 반드시 필요)
  const imageNode: ImageElement = {
    type: 'image',
    url,
    children: [{ text: '' }],
  };

  // 2) 현재 위치에 이미지 노드 삽입
  Transforms.insertNodes<ImageElement>(editor, imageNode);

  // 3) 이미지 바로 다음에 빈 단락(paragraph) 삽입 + 커서 이동
  if (editor.selection) {
    // selection 내부(보통 방금 삽입된 이미지 내부)에서 image 노드를 찾는다.
    const iter = Editor.nodes<SlateElement>(editor, {
      at: editor.selection as Range,
      mode: 'lowest',
      match: (n) => SlateElement.isElement(n) && (n as SlateElement).type === 'image',
    });

    const first = iter.next();
    if (!first.done) {
      const [, imagePath] = first.value;
      const nextPath = Path.next(imagePath);

      const paragraphNode: ParagraphElement = {
        type: 'paragraph',
        children: [{ text: '' }],
      };

      // 이미지 뒤에 빈 단락 삽입
      Transforms.insertNodes<ParagraphElement>(editor, paragraphNode, { at: nextPath });

      // 커서를 새 단락 시작 지점으로 이동
      const startOfNew = Editor.start(editor, nextPath);
      Transforms.select(editor, startOfNew);

      // React 환경에서 포커스 명확히 부여
      ReactEditor.focus(editor as any);
    }
  }
}
