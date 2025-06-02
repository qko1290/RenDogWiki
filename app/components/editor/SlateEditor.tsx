// File: app/components/editor/SlateEditor.tsx

/**
 * Slate 기반 위키 에디터(문서 생성/편집/저장/미리보기 등)
 * - 문서 메타(title, path, icon, tags), 내용(content) 상태 관리
 * - 툴바, 본문 편집, 목차 추출, 저장/미리보기 지원
 */

'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  createEditor, Descendant, Editor, Transforms, Range, Point, Element as SlateElement, Node, Path
} from 'slate';
import { Slate, Editable, withReact, ReactEditor, RenderLeafProps, RenderElementProps } from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';

import { Toolbar } from './Toolbar';
import Leaf from './Leaf';
import Element from './Element';
import TableOfContents from './TableOfContents';
import { extractHeadings } from './helpers/extractHeadings';
import type { CustomElement } from '@/types/slate';
import { renderSlateToHtml } from '@/wiki/lib/renderSlateToHtml';

type DocState = {
  id?: number;
  title: string;
  path: string;
  icon: string;
  tags: string[];
  content: Descendant[];
};

const EMPTY_INITIAL_VALUE: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

type Props = {
  initialDoc: DocState | null;
};

// 메인 에디터 컴포넌트
export default function SlateEditor({ initialDoc }: Props) {
  // 잘못된 진입 처리
  if (!initialDoc) return <div>잘못된 접근입니다.</div>;
  const path = initialDoc.path;

  // 에디터 인스턴스 + 커스텀 normalize
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));
    const { normalizeNode } = e;

    // info-box 블록 split/merge
    e.normalizeNode = ([node, path]) => {
      if (SlateElement.isElement(node) && node.type === 'info-box') {
        const text = Node.string(node);

        // 내용 없으면 절대 삭제하지 않음
        if (text === '') return;

        // children이 2개 이상일 땐 합쳐서 복구
        if (node.children.length > 1) {
          const merged = {
            ...node,
            children: [{ text: Node.string(node) }],
          };
          Transforms.removeNodes(e, { at: path });
          Transforms.insertNodes(e, merged, { at: path });
          return;
        }
      }
      normalizeNode([node, path]);
    };
    return e;
  }, []);

  // 커서 selection 저장용 ref
  const selectionRef = useRef<Range | null>(null);

  // 문서 상태/에디터키/모달 등
  const [editorKey, setEditorKey] = useState(0);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconEditTarget, setIconEditTarget] = useState<CustomElement | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔥 최초 mount 혹은 initialDoc.path/title이 바뀔 때만 doc 상태를 재설정한다.
  const [doc, setDoc] = useState<DocState>(() => ({
    title: initialDoc?.title ?? '',
    path: initialDoc?.path ?? '',
    icon: initialDoc?.icon ?? '',
    tags: Array.isArray(initialDoc?.tags) ? initialDoc.tags : [],
    content:
    Array.isArray(initialDoc.content) && initialDoc.content.length > 0
      ? initialDoc.content
      : EMPTY_INITIAL_VALUE,
  }));
  
  const [tagInput, setTagInput] = useState(doc.tags.join(', '));

  // 뒤로가기 방지(Backspace)
  useEffect(() => {
    const preventBackspaceNavigation = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (e.key === 'Backspace' && !isEditable) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', preventBackspaceNavigation);
    return () => window.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  // 블록 상태 콘솔 확인용
  useEffect(() => {
    if (editor.selection) {
      const [node] = Editor.nodes(editor, {
        match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
      });
      console.log('📌 현재 블록 노드:', node);
    }
  }, [doc.content, editor.selection]);

  // 목차(heading) 추출
  const headings = useMemo(() => extractHeadings(doc.content), [doc.content]);

  // heading 아이콘 클릭시 편집 메뉴 출력력(모달)
  const handleIconClick = (element: CustomElement) => {
    setIconEditTarget(element);
    setIsIconModalOpen(true);
  };

  // 렌더 함수
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);
  const renderElement = useCallback(
    (props: RenderElementProps) => (
      <Element {...props} editor={editor} onIconClick={handleIconClick} />
    ),
    [editor]
  );

  // 저장
  const handleSave = async () => {
    const res = await fetch(`/api/documents?all=1`);
    const allDocs = await res.json();
    if (!Array.isArray(allDocs)) { 
      console.error('API 반환값이 배열이 아닙니다:', allDocs);
      alert('서버 오류: 문서 목록 조회 실패');
      return; 
    }
    const isDuplicate = allDocs.some(d => d.path === doc.path && d.title === doc.title && d.id !== doc.id);

    if (isDuplicate) {
      alert('같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.');
      return;
    }

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });

      if (res.ok) {
        alert('저장 완료!');
      } else {
        console.error('문서 저장 실패 응답:', await res.text());
        alert('저장 실패');
      }
    } catch (err) {
      console.error('문서 저장 중 에러:', err);
      alert('문서 저장 실패');
    }
  };

  // 키이벤트 핸들러(heading/info-box/백스페이스 등)
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const HOTKEYS: Record<string, string> = {
      'mod+b': 'bold',
      'mod+i': 'italic',
      'mod+u': 'underline',
      'mod+shift+x': 'strikethrough',
    };

    for (const hotkey in HOTKEYS) {
      if (isHotkey(hotkey, event)) {
        event.preventDefault();
        const format = HOTKEYS[hotkey];
        Transforms.setNodes(
          editor,
          { [format]: true },
          {
            match: n => SlateElement.isElement(n) && Editor.isInline(editor, n),
          }
        );
      }
    }

    // heading에서 엔터 처리
    if (event.key === 'Enter') {
      const [match] = Editor.nodes(editor, {
        match: n =>
          SlateElement.isElement(n) &&
          ['heading-one', 'heading-two', 'heading-three'].includes(n.type),
      });
      if (match) {
        event.preventDefault();
        Transforms.insertNodes(editor, {
          type: 'paragraph',
          children: [{ text: '' }],
        });
        return;
      }
    }

    // info-box에서 엔터 무시
    if (event.key === 'Enter') {
      const [match] = Editor.nodes(editor, {
        match: n => SlateElement.isElement(n) && n.type === 'info-box',
      });
      if (match) {
        event.preventDefault();
        return;
      }
    }

    // heading에서 백스페이스 제거
    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [match] = Editor.nodes(editor, {
          match: n =>
            SlateElement.isElement(n) &&
            ['heading-one', 'heading-two', 'heading-three'].includes(n.type),
        });
        if (match) {
          const [, path] = match;
          const start = Editor.start(editor, path);
          if (Point.equals(selection.anchor, start)) {
            event.preventDefault();
            Transforms.removeNodes(editor, { at: path });
            Transforms.insertNodes(editor, {
              type: 'paragraph',
              children: [{ text: '' }],
            });
            const point = Editor.start(editor, [0]);
            Transforms.select(editor, point);
          }
        }
      }
    }

    // info-box 바로 밑 빈 줄에서 백스페이스 시 info-box도 같이 제거
    if (event.key === 'Backspace') {
      const { selection } = editor;

      if (selection && Range.isCollapsed(selection)) {
        const [currentBlock] = Editor.nodes(editor, {
          match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
        });

        if (!currentBlock) return;

        const [, currentPath] = currentBlock;

        // [0]일 경우 예외 방지
        if (currentPath[0] === 0) return;

        const prevPath = Path.previous(currentPath);

        try {
          const prevNode = Node.get(editor, prevPath);

          if (SlateElement.isElement(prevNode) && prevNode.type === 'info-box') {
            const isEmpty = Node.string(currentBlock[0]).length === 0;

            if (isEmpty) {
              event.preventDefault();

              // 빈 줄 삭제
              Transforms.removeNodes(editor, { at: currentPath });

              // info-box 삭제
              Transforms.removeNodes(editor, { at: prevPath });

              // 커서 위치 조정
              const newPath = prevPath[0] > 0 ? [prevPath[0] - 1] : [0];
              const point = Editor.end(editor, newPath);
              Transforms.select(editor, point);
              ReactEditor.focus(editor);

              return;
            }
          }
        } catch (e) {
          console.warn('💥 Backspace prevPath 접근 실패:', e);
        }
      }
    }
  };

  // 렌더 (툴바, 본문, 저장/미리보기, 목차)
  return (
    <div className="w-full flex justify-center">
      <div className="max-w-[1152px] w-full flex gap-6">
        {/* 에디터 영역 */}
        <div className="w-4/5">
          {/* 문서 제목 */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">문서 제목</label>
            <input
              type="text"
              value={doc.title}
              onChange={(e) => setDoc(prev => ({ ...prev, title: e.target.value }))}
              placeholder="문서 제목을 입력하세요"
              className="border px-3 py-1 rounded w-full"
              required
            />
          </div>

          {/* 태그 입력 */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onBlur={() => {
                const tags = tagInput.split('#')
                  .map(t => t.trim())
                  .filter(Boolean)
                  .map(t => '#'+t);
                setDoc(prev => ({ ...prev, tags }));
              }}
              placeholder="#태그1, #태그2"
              className="border px-3 py-1 rounded w-full"
            />
          </div>

          {/* 아이콘 입력 */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">문서 아이콘 (이모지)</label>
            <input
              type="text"
              value={doc.icon}
              onChange={(e) => setDoc(prev => ({ ...prev, icon: e.target.value }))}
              maxLength={2}
              placeholder="예: 📄"
              className="border px-3 py-1 rounded w-full"
            />
          </div>

          {/* 에디터 본문 */}
          <Slate
            key={editorKey}
            editor={editor}
            value={
              Array.isArray(doc.content) && doc.content.length > 0
                ? doc.content
                : EMPTY_INITIAL_VALUE
            }
            onChange={(newValue) => {
              setDoc(prev => ({ ...prev, content: newValue }));
              if (editor.selection) {
                selectionRef.current = editor.selection;
              }
            }}
          >
            <Toolbar selectionRef={selectionRef} />

            {/* 저장/미리보기 버튼 */}
            <div className="flex gap-2 my-2">
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-3 py-1 rounded"
              >
                저장하기
              </button>
              <button
                className="bg-gray-600 text-white px-3 py-1 rounded"
                onClick={() => {
                  const html = renderSlateToHtml(doc.content);
                  const preview = window.open('', '_blank');
                  if (preview) {
                    preview.document.write(`<html><body>${html}</body></html>`);
                    preview.document.close();
                  }
                }}
              >
                미리보기
              </button>
            </div>

            <Editable
              renderLeaf={renderLeaf}
              renderElement={renderElement}
              onKeyDown={onKeyDown}
              placeholder="문서를 작성하세요..."
              spellCheck={false}
              style={{
                border: '1px solid #ccc',
                padding: '12px',
                borderRadius: '6px',
                minHeight: '300px',
              }}
              onBlur={() => {
                selectionRef.current = editor.selection;
              }}
            />
          </Slate>
        </div>

        {/* 목차 영역 */}
        <div className="w-1/5">
          <TableOfContents headings={headings} />
        </div>
      </div>
    </div>
  );
}
