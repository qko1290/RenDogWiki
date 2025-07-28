// =============================================
// File: app/components/editor/helpers/insertImage.ts
// =============================================
/**
 * insertImage
 * - 현재 커서 위치에 이미지 블록(image node)을 삽입하는 Slate 에디터 유틸 함수
 * - 이미지 아래에 자동으로 빈 단락(paragraph)을 추가하여
 *   커서가 이미지 내에 머물지 않고, 사용자가 바로 이어서 입력 가능하도록 UX를 개선함
 * - 삽입 후 커서를 빈 단락으로 이동시키고, 에디터에 포커스를 명확히 줌
 */

import { Editor, Transforms, Range, Element as SlateElement, Node, Path } from 'slate';
import { ReactEditor } from 'slate-react';

/**
 * insertImage
 * @param editor Slate Editor 인스턴스
 * @param url 삽입할 이미지 URL
 */
export function insertImage(editor: Editor, url: string) {
  // 1. 이미지 노드 생성 (children에는 빈 텍스트 노드 필수)
  const imageNode: SlateElement = {
    type: 'image',
    url,
    children: [{ text: '' }],
  } as any;

  // 2. 현재 커서 위치에 이미지 노드 삽입
  Transforms.insertNodes(editor, imageNode);

  // 3. 이미지 바로 다음에 빈 단락(paragraph) 삽입 및 커서 이동
  //    → 커서가 이미지 블록 내에 남지 않고, 다음 줄로 바로 이동 가능하게 함
  if (editor.selection) {
    // selection은 Range 타입으로 안전하게 단언
    const [imageEntry] = Editor.nodes(editor, {
      at: editor.selection as Range,
      match: n => SlateElement.isElement(n) && n.type === 'image',
      mode: 'lowest',
    });
    if (imageEntry) {
      const [, imagePath] = imageEntry as [Node, Path];
      const nextPath = Path.next(imagePath);
      const paragraphNode: SlateElement = {
        type: 'paragraph',
        children: [{ text: '' }],
      } as any;

      // 이미지 뒤에 빈 단락 삽입
      Transforms.insertNodes(editor, paragraphNode, { at: nextPath });

      // 커서를 새 단락으로 이동
      Transforms.select(editor, nextPath);

      // 에디터에 포커스 강제 부여 (React 환경)
      ReactEditor.focus(editor as any);
    }
  }
}
