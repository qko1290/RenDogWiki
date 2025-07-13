// app/components/editor/helpers/setImageAlignment.ts
import { Editor, Transforms, Element as SlateElement } from 'slate';

export function setImageAlignment(editor: Editor, alignment: 'left' | 'center' | 'right' | 'justify') {
  if (!editor.selection) return;
  const [imageEntry] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'image',
    mode: 'lowest', // 가장 가까운 image 블록만 변경
  });
  if (imageEntry) {
    const [, path] = imageEntry;
    Transforms.setNodes(editor, { textAlign: alignment }, { at: path });
  }
}
