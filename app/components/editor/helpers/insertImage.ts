import { Editor, Transforms, Range, Element as SlateElement, Node, Path } from 'slate';
import { ReactEditor } from 'slate-react';

export function insertImage(editor: Editor, url: string) {
  const imageNode: SlateElement = {
    type: 'image',
    url,
    children: [{ text: '' }],
  } as any;

  Transforms.insertNodes(editor, imageNode);

  // ↓↓↓ 수정된 부분 ↓↓↓
  if (editor.selection) {
    // 반드시 Range로 단언!
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

      Transforms.insertNodes(editor, paragraphNode, { at: nextPath });
      Transforms.select(editor, nextPath);
      ReactEditor.focus(editor as any);
    }
  }
}
