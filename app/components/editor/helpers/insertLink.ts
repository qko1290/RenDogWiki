// =============================================
// File: app/components/editor/helpers/insertLink.ts
// =============================================
/**
 * 에디터에 하이퍼링크/링크블럭 삽입 유틸리티
 * - 인라인: 드래그(선택)중인 텍스트 -> <a> 하이퍼링크로 래핑
 *   - 선택이 없으면 해당 위치에 URL 자체를 삽입
 * - 블럭: 선택 없음(커서만) 상태에서, 현재 줄에 링크 카드(링크블럭) 삽입(빈 줄 권장)
 */

import { Editor, Transforms, Range, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';
import type { LinkElement, LinkBlockElement, ParagraphElement } from '@/types/slate';

/**
 * [인라인 링크 삽입]
 * - 선택(드래그) 영역 있으면: 해당 영역만 <a>로 래핑(하이퍼링크)
 * - 선택 없음(커서만): url을 해당 위치에 텍스트로 삽입(<a> 포함)
 * - url: 외부/내부 링크 모두 가능
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
    // 선택 없음: url 자체를 <a>로 삽입
    Transforms.insertNodes(editor, link);
  } else {
    // 일부 영역 선택: 해당 영역을 <a>로 래핑
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' }); // 커서를 끝으로 이동
  }
};

/**
 * [링크 블럭(카드) 삽입]
 * - selection이 없으면 문서 맨끝에 커서 강제 위치 지정
 * - URL로부터 sitename, favicon 등 자동 생성
 * - 삽입 후 하위에 빈 단락도 추가(커서 UX 개선)
 */
export const insertLinkBlock = (editor: Editor, url: string) => {
  // 커서/선택 없으면 문서 맨 끝에 커서 이동 후 삽입
  if (!editor.selection) {
    ReactEditor.focus(editor);

    // 문서가 비었거나 selection이 없을 경우 임의의 위치(맨끝)에 삽입
    const insertPoint = Editor.end(editor, []);
    Transforms.select(editor, insertPoint);
  }

  // sitename, favicon 자동 추출
  const hostname = new URL(url).hostname.replace('www.', '');
  const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;

  const linkBlock: LinkBlockElement = {
    type: 'link-block',
    url,
    size: 'large',           // 블럭 크기
    favicon,
    sitename: hostname,
    children: [{ text: '' }],
  };

  // UX 개선: 하위에 빈 단락도 함께 삽입
  const paragraph: ParagraphElement = {
    type: 'paragraph',
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, [linkBlock, paragraph]);
};

/**
 * [인라인 링크 해제]
 * - 현재 선택영역(또는 커서)이 <a> 내부면 unwrapNodes로 <a> 해제
 */
export const unwrapLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
  });
};

/**
 * [커서/선택이 링크 내부인지 판별]
 * - 현재 커서가 <a> 내부면 true 반환(링크 스타일 토글 등에서 활용)
 */
export const isLinkActive = (editor: Editor) => {
  const [match] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'link',
  });
  return !!match;
};
