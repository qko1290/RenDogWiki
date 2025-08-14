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

// 링크 뒤로 커서를 확실히 빼내는 유틸(인라인 <a> 전용)
function moveCaretOutOfLink(editor: Editor) {
  // 현재 커서 기준으로 가장 가까운 link 요소 찾기
  const linkEntry = Editor.above(editor, {
    match: n => SlateElement.isElement(n) && (n as any).type === 'link',
  });
  if (!linkEntry) return;

  const [, linkPath] = linkEntry;

  // 1) 링크 내부 끝으로 접고
  Transforms.collapse(editor, { edge: 'end' });

  // 2) 링크 '바로 다음' 포인트 시도
  const after = Editor.after(editor, linkPath);
  if (after) {
    Transforms.select(editor, after);
    ReactEditor.focus(editor);
    return;
  }

  // 3) fallback: 링크의 다음 위치에 빈 텍스트 노드 삽입 후 그리로 이동
  // (블록 자식 레벨에서는 텍스트 노드가 유효)
  const afterPath = Path.next(linkPath);
  Transforms.insertNodes(editor, { text: '' }, { at: afterPath, select: true });
  ReactEditor.focus(editor);
}

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
    // 커서만 있을 때: 링크 노드 자체를 삽입
    Transforms.insertNodes(editor, linkEl as any);
    // 링크 밖으로 이동 (normalize 이후 다음 tick에)
    setTimeout(() => moveCaretOutOfLink(editor), 0);
  } else {
    // 드래그 선택: 선택 범위 래핑
    Transforms.wrapNodes(editor, linkEl as any, { split: true });
    // 래핑한 링크 밖으로 이동
    setTimeout(() => moveCaretOutOfLink(editor), 0);
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
  const trimmed = (url ?? '').trim();
  if (!trimmed) return;

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
      url: trimmed,
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
      const parsed = new URL(trimmed);
      sitename = parsed.hostname.replace(/^www\./, '');
      // favicon 경로는 보편적인 /favicon.ico로 시도(없으면 표시만 실패)
      favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
    } catch {
      // 잘못된 URL은 sitename/favicon 비움
    }
    linkBlock = {
      type: 'link-block',
      url: trimmed,
      size: opts?.size || 'large',
      sitename,
      favicon,
      isWiki: false,
      children: [{ text: '' }],
    };
  }

  // 링크 블록과 빈 단락을 한 번에 삽입 (sibling)
  const afterBlock: ParagraphElement = { type: 'paragraph', children: [{ text: '' }] };
  Transforms.insertNodes(editor, [linkBlock as any, afterBlock as any]);
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

  const trimmed = (url ?? '').trim();
  if (!trimmed) return;

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
    (n: any) => n.type === 'link-block' && n.size === 'small'
  );

  // 이미 1개만 있는 경우 같은 줄에 insert
  if (halfBlocks.length === 1 && children.length === 1) {
    const insertPath = blockPath.concat(children.length);
    Transforms.insertNodes(
      editor,
      [
        {
          type: 'link-block',
          url: trimmed,
          size: 'small',
          children: [{ text: '' }],
          ...opts,
        } as LinkBlockElement,
      ],
      { at: insertPath }
    );
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
      {
        type: 'link-block',
        url: trimmed,
        size: 'small',
        children: [{ text: '' }],
        ...opts,
      } as LinkBlockElement,
      {
        type: 'paragraph',
        children: [{ text: '' }],
      } as ParagraphElement,
    ],
    { at: insertPath }
  );
  const after = Editor.after(editor, insertPath);
  if (after) Transforms.select(editor, after);
  ReactEditor.focus(editor);
}

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

  // 커서를 링크 뒤로 이동
  const { selection } = editor;
  if (selection) {
    const after = Editor.after(editor, selection.focus);
    if (after) Transforms.select(editor, after);
  }

  // 블록이 link 타입인 경우 paragraph로 교체(안전 장치)
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
