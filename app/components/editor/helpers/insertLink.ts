// =============================================
// File: app/components/editor/helpers/insertLink.ts
// =============================================
/**
 * 에디터에 하이퍼링크/링크블럭 삽입 유틸리티
 * - 인라인: 드래그(선택)중인 텍스트 -> <a> 하이퍼링크로 래핑
 *   - 선택이 없으면 해당 위치에 URL 자체를 삽입
 * - 블럭: 선택 없음(커서만) 상태에서, 현재 줄에 링크 카드(링크블럭) 삽입(빈 줄 권장)
 */

import { Editor, Transforms, Range, Path, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';
import type { LinkElement, LinkBlockElement, ParagraphElement } from '@/types/slate';

/**
 * [인라인 링크 삽입]
 * - 선택(드래그) 영역 있으면: 해당 영역만 <a>로 래핑(하이퍼링크)
 * - 선택 없음(커서만): url을 해당 위치에 텍스트로 삽입(<a> 포함)
 * - url: 외부/내부 링크 모두 가능
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
    // 커서만: 하이퍼링크로 텍스트 삽입
    Transforms.insertNodes(editor, link);
    setTimeout(() => {
      // 링크 뒤로 커서 이동
      const { selection } = editor;
      if (selection) {
        const after = Editor.after(editor, selection.focus, { unit: 'offset' });
        if (after) Transforms.select(editor, after);
        ReactEditor.focus(editor);
      }
    }, 0);
  } else {
    // 드래그(선택 영역): 하이퍼링크로 래핑
    Transforms.wrapNodes(editor, link, { split: true });
    setTimeout(() => {
      // 래핑된 링크의 끝으로 커서 이동 (★)
      const { selection } = editor;
      if (selection) {
        // 링크 노드의 path로부터 end 위치 구함
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
 * [링크 블럭(카드) 삽입]
 * - selection이 없으면 문서 맨끝에 커서 강제 위치 지정
 * - URL로부터 sitename, favicon 등 자동 생성
 * - 삽입 후 하위에 빈 단락도 추가(커서 UX 개선)
 */
export const insertLinkBlock = (
  editor: Editor,
  url: string,
  opts?: Partial<LinkBlockElement>
) => {
  if (!editor.selection) {
    ReactEditor.focus(editor);
    const insertPoint = Editor.end(editor, []);
    Transforms.select(editor, insertPoint);
  }

  let linkBlock: LinkBlockElement;

  // 1. 내부 문서(위키 링크)
  if (opts?.isWiki) {
    linkBlock = {
      type: 'link-block',
      url,
      size: 'large',
      sitename: opts.sitename || opts.wikiTitle || '', // 문서명
      favicon: undefined, // 내부문서는 파비콘 없음
      isWiki: true,
      wikiTitle: opts.wikiTitle,
      wikiPath: opts.wikiPath,
      children: [{ text: '' }],
    };
  }
  // 2. 외부 URL (기존 자동 메타데이터 추출)
  else {
    // 메타데이터 파싱(비동기 fetch가 아니라면 url에서 도메인 추출 등)
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
      size: 'large',
      sitename: sitename,
      favicon: favicon,
      isWiki: false,
      children: [{ text: '' }],
    };
  }

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
    split: true,
  });

  // 커서를 링크 바로 뒤로 이동
  const { selection } = editor;
  if (selection) {
    const after = Editor.after(editor, selection.focus);
    if (after) Transforms.select(editor, after);
  }

  // ★★★ 블록 노드의 link-related 속성 강제 제거 (에러 없이) ★★★
  if (selection) {
    const [blockEntry] = Editor.nodes(editor, {
      match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
    });
    if (blockEntry) {
      const [blockNode, path] = blockEntry;
      // 블록에 type: 'link'인 경우만 paragraph로 초기화(그리고 url 등은 빼고)
      if (SlateElement.isElement(blockNode) && blockNode.type === 'link') {
        Transforms.setNodes(
          editor,
          { type: 'paragraph' }, // url 등 기타 속성 제거
          { at: path }
        );
      }
    }
  }
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
