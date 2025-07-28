// =============================================
// File: app/components/editor/helpers/insertLink.ts
// =============================================
/**
 * 에디터에서 인라인/블록 링크 삽입 및 해제 유틸리티
 * - 선택 영역 드래그: 하이퍼링크(<a>)로 래핑
 * - 커서만 있을 때: 해당 위치에 url 자체 삽입
 * - 블록(링크카드): 현재 줄에 링크 카드 삽입, 이후 빈 단락 자동 추가
 */

import { Editor, Transforms, Range, Path, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';
import type { LinkElement, LinkBlockElement, ParagraphElement } from '@/types/slate';

/**
 * [인라인 링크 삽입]
 * - 선택 영역 있으면: 해당 부분만 하이퍼링크(<a>)로 래핑
 * - 선택이 없으면: 커서 위치에 url을 텍스트로 삽입
 */
export const insertLink = (editor: Editor, url: string, text?: string) => {
  if (!editor.selection) {
    alert('커서가 본문에 없습니다!');
    return;
  }
  const isCollapsed = Range.isCollapsed(editor.selection);

  const link: LinkElement = {
    type: 'link',
    url,
    children: isCollapsed ? [{ text: text ?? url }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, link);

    // 링크 뒤로 커서 이동
    setTimeout(() => {
      const { selection } = editor;
      if (selection) {
        const after = Editor.after(editor, selection.focus, { unit: 'offset' });
        if (after) Transforms.select(editor, after);
        ReactEditor.focus(editor);
      }
    }, 0);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });

    // 래핑된 링크 끝으로 커서 이동
    setTimeout(() => {
      const { selection } = editor;
      if (selection) {
        const end = Editor.end(editor, selection.focus.path);
        if (end) {
          Transforms.select(editor, end);
          ReactEditor.focus(editor);
        }
      }
    }, 0);
  }
};

/**
 * [링크 블록(카드) 삽입]
 * - 내부 위키/외부 URL 구분하여 sitename, favicon 자동 세팅
 * - 링크 카드 뒤에 빈 단락 추가(입력 UX 개선)
 */
export const insertLinkBlock = (
  editor: Editor,
  url: string,
  opts?: Partial<LinkBlockElement>
) => {
  // selection이 없으면 문서 끝에 강제로 위치 지정
  if (!editor.selection) {
    ReactEditor.focus(editor);
    const insertPoint = Editor.end(editor, []);
    Transforms.select(editor, insertPoint);
  }

  let linkBlock: LinkBlockElement;
  if (opts?.isWiki) {
    linkBlock = {
      type: 'link-block',
      url,
      size: opts.size || 'large',
      sitename: opts.sitename || opts.wikiTitle || '',
      favicon: undefined,
      isWiki: true,
      wikiTitle: opts.wikiTitle,
      wikiPath: opts.wikiPath,
      children: [{ text: '' }],
    };
  } else {
    // 외부 URL 처리
    let sitename = '';
    let favicon = '';
    try {
      const parsed = new URL(url);
      sitename = parsed.hostname.replace(/^www\./, '');
      favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
    } catch {}
    linkBlock = {
      type: 'link-block',
      url,
      size: opts?.size || 'large',
      sitename,
      favicon,
      isWiki: false,
      children: [{ text: '' }],
    };
  }

  // 링크 블록과 빈 단락을 한 번에 삽입 (sibling)
  Transforms.insertNodes(editor, [
    linkBlock,
    { type: 'paragraph', children: [{ text: '' }] }
  ]);
};

/**
 * [작은 링크 블록(반띵) 삽입]
 * - 한 줄에 small 카드가 1개만 있으면 같은 줄에 추가
 * - 아니면 새 줄에 삽입
 */
export function insertHalfLinkBlock(
  editor: Editor,
  url: string,
  opts: Partial<LinkBlockElement> = {}
) {
  if (!editor.selection) return;

  const blockEntry = Editor.above(editor, {
    at: editor.selection,
    match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
  if (!blockEntry) return;

  const [blockNode, blockPath] = blockEntry;
  if (!SlateElement.isElement(blockNode)) return;

  const children = Array.isArray(blockNode.children)
    ? blockNode.children.filter(SlateElement.isElement)
    : [];

  const halfBlocks = children.filter(
    (n: any) => n.type === "link-block" && n.size === "small"
  );

  // 이미 1개만 있는 경우 같은 줄에 insert
  if (halfBlocks.length === 1 && children.length === 1) {
    const insertPath = blockPath.concat(children.length);
    Transforms.insertNodes(
      editor,
      [{
        type: "link-block",
        url,
        size: "small",
        children: [{ text: "" }],
        ...opts,
      } as LinkBlockElement],
      { at: insertPath }
    );
    Transforms.select(editor, Editor.after(editor, insertPath)!);
    ReactEditor.focus(editor);
    return;
  }

  // 아니면 한 줄 아래에 추가
  const insertPath = Path.next(blockPath);
  Transforms.insertNodes(
    editor,
    [
      {
        type: "link-block",
        url,
        size: "small",
        children: [{ text: "" }],
        ...opts,
      } as LinkBlockElement,
      {
        type: "paragraph",
        children: [{ text: "" }],
      } as ParagraphElement,
    ],
    { at: insertPath }
  );
  Transforms.select(editor, Editor.after(editor, insertPath)!);
  ReactEditor.focus(editor);
}

/**
 * [인라인 링크 해제]
 * - 현재 커서/선택이 <a> 내부라면 unwrapNodes로 <a> 해제
 * - 블록 노드가 link면 type을 paragraph로 초기화
 */
export const unwrapLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
    split: true,
  });

  // 커서를 링크 뒤로 이동
  const { selection } = editor;
  if (selection) {
    const after = Editor.after(editor, selection.focus);
    if (after) Transforms.select(editor, after);
  }

  // 블록이 link 타입인 경우 paragraph로 교체
  if (selection) {
    const [blockEntry] = Editor.nodes(editor, {
      match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
    });
    if (blockEntry) {
      const [blockNode, path] = blockEntry;
      if (SlateElement.isElement(blockNode) && blockNode.type === 'link') {
        Transforms.setNodes(
          editor,
          { type: 'paragraph' },
          { at: path }
        );
      }
    }
  }
};

/**
 * [커서가 링크 내부인지 판별]
 * - 현재 선택 또는 커서 위치가 <a> 내부면 true
 */
export const isLinkActive = (editor: Editor) => {
  const [match] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
  });
  return !!match;
};
