// File: app/components/editor/helpers/insertLink.ts

/**
 * 에디터에 하이퍼링크/링크블럭 삽입 유틸
 * - 인라인: 드래그(선택)중인 텍스트가 있을 시 동작, 텍스트를 하이퍼링크로 만들어줌줌
 * - 링크 블럭: 선택중인 텍스트가 없을 시 커서 위치의 줄에 블럭을 삽입 (비어있는 줄에만 사용하세요요)
 */

import { Editor, Transforms, Range, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';
import type { LinkElement, LinkBlockElement, ParagraphElement } from '@/types/slate';

// 인라인 링크 삽입
/**
 * - 선택 드래그 시: 해당 영역만 <a>로 래핑
 * - 커서만(선택 없음): URL을 바로 삽입
 */
export const insertLink = (editor: Editor, url: string) => {
  if (!editor.selection) return;
  const isCollapsed = Range.isCollapsed(editor.selection);

  const link: LinkElement = {
    type: 'link',
    url,
    children: isCollapsed ? [{ text: url }] : [],
  };

  if (isCollapsed) {
    // 선택 없을 때: url 자체를 삽입
    Transforms.insertNodes(editor, link);
  } else {
    // 일부 선택: 해당 영역만 래핑
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' });
  }
};

// 링크 블럭(카드) 삽입
/**
 * selection이 없으면 커서 강제 위치 지정(문서 맨끝)
 * 하위에 빈 단락도 함께 삽입(UX 개선용용)
 */
export const insertLinkBlock = (editor: Editor, url: string) => {
  // 커서/선택 없을 때: 문서 맨 끝에 삽입
  if (!editor.selection) {
    ReactEditor.focus(editor);

    // 문서가 비었거나 selection이 없을 경우 임의의 위치에 삽입
    const insertPoint = Editor.end(editor, []);
    Transforms.select(editor, insertPoint);
  }

  const hostname = new URL(url).hostname.replace('www.', '');
  const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;

  const linkBlock: LinkBlockElement = {
    type: 'link-block',
    url,
    size: 'large',
    favicon,
    sitename: hostname,
    children: [{ text: '' }],
  };

  // 하위에 빈 단락 추가
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, [linkBlock, paragraph]);
};

// 인라인 링크 해제
export const unwrapLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
  });
};

// 커서/선택이 링크 내부인지 판별
// 현재 커서가 <a> 링크 안에 있으면 true값 반환환
export const isLinkActive = (editor: Editor) => {
  const [match] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
  });
  return !!match;
};
