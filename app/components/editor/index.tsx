// =============================================
// File: app/components/editor/index.tsx
// =============================================

/**
 * Slate 에디터 메인 컴포넌트
 * - 에디터 인스턴스, 툴바, 본문, 목차, heading 아이콘 모달 등 전체 구조 관리
 * - 에디터 value 상태, selection, heading 아이콘 수정 등 주요 인터랙션 제공
 */

'use client';

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  createEditor,
  Descendant,
  Editor,
  Transforms,
  Range,
  Point,
  Element as SlateElement,
  Node,
} from 'slate';
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  RenderLeafProps,
  RenderElementProps,
} from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';

import { Toolbar } from './Toolbar';
import Leaf from './Leaf';
import Element from './Element';
import TableOfContents from './TableOfContents';
import { extractHeadings } from './helpers/extractHeadings';

import type { CustomElement } from '@/types/slate';

export default function SlateEditor() {
  // 에디터 인스턴스 생성 (link-block, divider를 void 처리)
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));
    const originalIsVoid = e.isVoid;
    e.isVoid = element =>
      element.type === 'link-block' || element.type === 'divider'
        ? true
        : originalIsVoid(element);
    return e;
  }, []);

  // selection 보존용 ref
  const selectionRef = useRef<Range | null>(null);

  // 에디터 값, heading 아이콘 모달 상태
  const [value, setValue] = useState<Descendant[]>([
    { type: 'paragraph', children: [{ text: '' }] },
  ]);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconEditTarget, setIconEditTarget] = useState<CustomElement | null>(
    null
  );

  // 브라우저에서 input이 아닌 상태 Backspace 방지(뒤로가기 방지)
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
    return () =>
      window.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  // heading 목록(목차) 추출
  const headings = useMemo(() => extractHeadings(value), [value]);

  // heading 아이콘 클릭 시 수정 모달 오픈
  const handleIconClick = (element: CustomElement) => {
    setIconEditTarget(element);
    setIsIconModalOpen(true);
  };

  // Slate 렌더 함수(leaf, element)
  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <Leaf {...props} />,
    []
  );
  const renderElement = useCallback(
    (props: RenderElementProps) => (
      <Element
        {...props}
        editor={editor}
        onIconClick={handleIconClick}
        // priceTableEdit 관련 props가 있다면 여기에 추가 필요
      />
    ),
    [editor]
  );

  // 단축키 및 heading block 전용 keydown 핸들러
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // 텍스트 스타일 단축키
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
            match: n =>
              SlateElement.isElement(n) && Editor.isInline(editor, n),
          }
        );
      }
    }

    // heading 블록에서 Backspace(맨 앞)시 paragraph로 변환
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

    // heading 블록에서 Enter시 아래에 단락 추가
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
      }
    }
  };

  // 렌더(툴바, 에디터, 목차, heading 아이콘 모달 등)
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <Slate editor={editor} value={value} onChange={setValue}>
          <Toolbar selectionRef={selectionRef} />
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
      {/* 우측 목차 */}
      <TableOfContents headings={headings} />
      {/* heading 아이콘 수정 모달 */}
      {isIconModalOpen && iconEditTarget && (
        <div
          style={{
            position: 'fixed',
            top: '30%',
            left: '40%',
            background: 'white',
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            zIndex: 1000,
            boxShadow: '0 0 10px rgba(0,0,0,0.2)',
          }}
        >
          <h4>아이콘 수정</h4>
          <input
            type="text"
            placeholder="이모지 또는 이미지 URL 입력"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const newIcon = (e.target as HTMLInputElement).value;
                if (
                  iconEditTarget &&
                  SlateElement.isElement(iconEditTarget)
                ) {
                  const path = ReactEditor.findPath(editor, iconEditTarget);
                  Transforms.setNodes(editor, { icon: newIcon }, { at: path });
                }
                setIsIconModalOpen(false);
                setIconEditTarget(null);
              }
            }}
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <div>
            <button
              onClick={() => {
                setIsIconModalOpen(false);
                setIconEditTarget(null);
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
