/**
 * 에디터에서 인라인/블록 링크 삽입 및 해제 유틸리티
 * - 선택 영역 드래그: 하이퍼링크(<a>)로 래핑
 * - 커서만 있을 때: 해당 위치에 url 자체 삽입
 * - 블록(링크카드): 현재 줄에 링크 카드 삽입, 이후 빈 단락 자동 추가
 */

import { Editor, Transforms, Range, Path, Element as SlateElement, Point } from 'slate';
import { ReactEditor } from 'slate-react';
import type { LinkElement, LinkBlockElement, ParagraphElement } from '@/types/slate';

// =============== 공통 유틸 ===============
function moveCaretOutOfLink(editor: Editor) {
  const linkEntry = Editor.above(editor, {
    match: n => SlateElement.isElement(n) && (n as any).type === 'link',
  });
  if (!linkEntry) return;

  const [, linkPath] = linkEntry;

  // 1) 링크 내부 끝으로 접고
  Transforms.collapse(editor, { edge: 'end' });

  // 2) 링크 바로 다음 포인트로 이동 시도
  const after = Editor.after(editor, linkPath);
  if (after) {
    Transforms.select(editor, after);
    ReactEditor.focus(editor);
    return;
  }

  // 3) fallback: 링크 다음 위치에 빈 텍스트 삽입 후 이동
  const afterPath = Path.next(linkPath);
  Transforms.insertNodes(editor, { text: '' }, { at: afterPath, select: true });
  ReactEditor.focus(editor);
}

function parseExternal(url: string): { sitename: string; favicon: string } {
  try {
    const u = new URL(url);
    const sitename = u.hostname.replace(/^www\./, '');
    const favicon = `${u.protocol}//${u.hostname}/favicon.ico`;
    return { sitename, favicon };
  } catch {
    return { sitename: '', favicon: '' };
  }
}

function buildLinkBlock(
  url: string,
  size: 'large' | 'small',
  opts?: Partial<LinkBlockElement>
): LinkBlockElement {
  const trimmed = (url ?? '').trim();

  if (opts?.isWiki) {
    return {
      type: 'link-block',
      url: trimmed,
      size,
      sitename: opts.sitename || opts.wikiTitle || '',
      favicon: undefined,
      isWiki: true,
      wikiTitle: opts.wikiTitle,
      wikiPath: opts.wikiPath,
      docIcon: opts.docIcon,
      children: [{ text: '' }],
    };
  }

  const { sitename, favicon } = parseExternal(trimmed);
  return {
    type: 'link-block',
    url: trimmed,
    size,
    sitename,
    favicon,
    isWiki: false,
    children: [{ text: '' }],
  } as LinkBlockElement;
}

// =============== 인라인 링크 ===============
/**
 * [인라인 링크 삽입]
 * - 선택 영역 있으면: 해당 부분만 하이퍼링크(<a>)로 래핑
 * - 선택이 없으면: 커서 위치에 url을 텍스트로 삽입
 */
export const insertLink = (editor: Editor, url: string, text?: string) => {
  if (!editor.selection) return;

  const trimmed = (url ?? '').trim();
  if (!trimmed) return;

  const isCollapsed = Range.isCollapsed(editor.selection);
  const linkEl: LinkElement = {
    type: 'link',
    url: trimmed,
    children: isCollapsed ? [{ text: text ?? trimmed }] : [],
  };

  // 이미 링크 안이면 먼저 unwrap (중첩 방지)
  const [inLink] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && (n as any).type === 'link',
  });
  if (inLink) {
    Transforms.unwrapNodes(editor, {
      match: n => SlateElement.isElement(n) && (n as any).type === 'link',
    });
  }

  if (isCollapsed) {
    Transforms.insertNodes(editor, linkEl as any);
    setTimeout(() => moveCaretOutOfLink(editor), 0);
  } else {
    Transforms.wrapNodes(editor, linkEl as any, { split: true });
    setTimeout(() => moveCaretOutOfLink(editor), 0);
  }
};

// =============== 블록 링크(큰 카드) ===============
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
  const trimmed = (url ?? '').trim();
  if (!trimmed) return;

  // selection이 없으면 문서 끝으로 포커스 이동
  if (!editor.selection) {
    ReactEditor.focus(editor);
    const insertPoint = Editor.end(editor, []);
    Transforms.select(editor, insertPoint);
  }

  const linkBlock = buildLinkBlock(trimmed, opts?.size === 'small' ? 'small' : 'large', opts);

  // 링크 블록과 빈 단락을 한 번에 삽입 (sibling)
  const afterBlock: ParagraphElement = { type: 'paragraph', children: [{ text: '' }] };
  Transforms.insertNodes(editor, [linkBlock as any, afterBlock as any]);
};

// =============== 블록 링크(작은 카드, 반띵) ===============
/**
 * [작은 링크 블록(반띵) 삽입]
 * - 한 줄에 small 카드가 1개만 있으면 같은 줄에 추가
 * - 아니면 새 줄에 삽입
 * - (수정) 외부 URL일 때도 sitename/favicon 자동 세팅
 * - (수정) selection 없으면 문서 끝으로 이동 후 삽입
 */
export function insertHalfLinkBlock(
  editor: Editor,
  url: string,
  opts: Partial<LinkBlockElement> = {}
) {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return;

  // selection이 없으면 문서 끝으로 포커스 이동 (insertLinkBlock과 동일 보강)
  if (!editor.selection) {
    ReactEditor.focus(editor);
    const end = Editor.end(editor, []);
    Transforms.select(editor, end);
  }

  const blockEntry = Editor.above(editor, {
    at: editor.selection ?? undefined,
    match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
  if (!blockEntry) return;

  const [blockNode, blockPath] = blockEntry;
  if (!SlateElement.isElement(blockNode)) return;

  const children = Array.isArray(blockNode.children)
    ? blockNode.children.filter(SlateElement.isElement)
    : [];

  const halfBlocks = children.filter(
    (n: any) => n.type === 'link-block' && n.size === 'small'
  );

  const nodeToInsert = buildLinkBlock(trimmed, 'small', opts);

  // 이미 1개만 있는 경우 같은 줄에 insert
  if (halfBlocks.length === 1 && children.length === 1) {
    const insertPath = blockPath.concat(children.length);
    Transforms.insertNodes(editor, [nodeToInsert as any], { at: insertPath });
    const after = Editor.after(editor, insertPath);
    if (after) Transforms.select(editor, after);
    ReactEditor.focus(editor);
    return;
  }

  // 아니면 한 줄 아래에 추가
  const insertPath = Path.next(blockPath);
  Transforms.insertNodes(
    editor,
    [
      nodeToInsert as any,
      { type: 'paragraph', children: [{ text: '' }] } as ParagraphElement,
    ],
    { at: insertPath }
  );
  const after = Editor.after(editor, insertPath);
  if (after) Transforms.select(editor, after);
  ReactEditor.focus(editor);
}

// =============== 링크 해제/상태 체크 ===============
/**
 * [인라인 링크 해제]
 * - 현재 커서/선택이 <a> 내부라면 unwrapNodes로 <a> 해제
 * - 블록 노드가 link면 type을 paragraph로 초기화
 */
export const unwrapLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: n => SlateElement.isElement(n) && (n as any).type === 'link',
    split: true,
  });

  const { selection } = editor;
  if (selection) {
    const after = Editor.after(editor, selection.focus);
    if (after) Transforms.select(editor, after);
  }

  if (selection) {
    const [blockEntry] = Editor.nodes(editor, {
      match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
    });
    if (blockEntry) {
      const [blockNode, path] = blockEntry;
      if (SlateElement.isElement(blockNode) && (blockNode as any).type === 'link') {
        Transforms.setNodes(
          editor,
          { type: 'paragraph' } as Partial<ParagraphElement>,
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
    match: n => SlateElement.isElement(n) && (n as any).type === 'link',
  });
  return !!match;
};
