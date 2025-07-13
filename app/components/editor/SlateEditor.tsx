// =============================================
// File: app/components/editor/SlateEditor.tsx
// =============================================
/**
 * 위키 에디터(문서 생성/편집/저장/미리보기 등)
 * - 문서 메타(title, path, icon, tags), 내용(content) 상태 관리
 * - 툴바, 본문 편집, 목차 추출, 저장/미리보기 지원
 * - 백스페이스/엔터 등 UX 커스텀, selectionRef로 커서 보존
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
import ImageSelectModal from '@/components/image/ImageSelectModal';
import '@/wiki/css/editor.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

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
  isMain?: boolean;
};

// 메인 에디터 컴포넌트
export default function SlateEditor({ initialDoc, isMain = false }: Props) {
  // 진입 유효성 검사(잘못된 접근 처리)
  if (!initialDoc) return <div>잘못된 접근입니다.</div>;
  const path = initialDoc.path;

  const withLinks = (editor: Editor) => {
    const { isInline } = editor;
    editor.isInline = element =>
      element.type === 'link' ? true : isInline(element);
    return editor;
  };

  // 에디터 인스턴스 생성
  const editor = useMemo(() => {
    const e = withLinks(withHistory(withReact(createEditor())));
    // 이하 기존 코드 유지
    const { normalizeNode } = e;

    // info-box: children 2개 이상이면 텍스트 합쳐 복구
    e.normalizeNode = ([node, path]) => {
      if (SlateElement.isElement(node) && node.type === 'info-box') {
        const text = Node.string(node);

        // 내용이 없을 때는 삭제 X
        if (text === '') return;

        // children 2개 이상: 내용 합쳐 하나로 복구
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

  // 커서 selection 저장 ref(툴바/드롭다운/버튼 등 연동)
  const selectionRef = useRef<Range | null>(null);

  // 문서 상태/에디터키/아이콘모달/로딩
  const [editorKey, setEditorKey] = useState(0);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconEditTarget, setIconEditTarget] = useState<CustomElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [moveCursorPending, setMoveCursorPending] = useState(false);
  const [lastLinkPath, setLastLinkPath] = useState<Path | null>(null);  
  const [iconModalOpen, setIconModalOpen] = useState(false);

  // 최초 mount 및 문서경로/제목 바뀔 때 doc 상태 재설정
  const [doc, setDoc] = useState<DocState>(() => ({
    id: initialDoc?.id ?? undefined,
    title: initialDoc?.title ?? '',
    path: initialDoc?.path ?? '',
    icon: initialDoc?.icon ?? '',
    tags: Array.isArray(initialDoc?.tags) ? initialDoc.tags : [],
    content:
      Array.isArray(initialDoc.content) && initialDoc.content.length > 0
        ? initialDoc.content
        : EMPTY_INITIAL_VALUE,
  }));

  // 태그 input 상태(쉼표/해시 지원)
  const [tagInput, setTagInput] = useState(doc.tags.join(', '));

  useEffect(() => {
    setDoc({
      id: initialDoc?.id ?? undefined,
      title: initialDoc?.title ?? '',
      path: initialDoc?.path ?? '',
      icon: initialDoc?.icon ?? '',
      tags: Array.isArray(initialDoc?.tags) ? initialDoc.tags : [],
      content:
        Array.isArray(initialDoc?.content) && initialDoc.content.length > 0
          ? initialDoc.content
          : EMPTY_INITIAL_VALUE,
    });
  }, [initialDoc]);

  // 브라우저 전체 백스페이스로 뒤로가기 방지
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

  useEffect(() => {
    if (moveCursorPending && lastLinkPath) {
      const after = Editor.after(editor, lastLinkPath);
      if (after) {
        Transforms.select(editor, after);
        ReactEditor.focus(editor);
      }
      setMoveCursorPending(false);
      setLastLinkPath(null);
    }
  }, [doc.content, moveCursorPending, lastLinkPath]);

  // 블록 상태 콘솔 디버깅용(useEffect)
  useEffect(() => {
    if (editor.selection) {
      const [node] = Editor.nodes(editor, {
        match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
      });
    }
  }, [doc.content, editor.selection]);

  // 목차(heading) 추출
  const headings = useMemo(() => extractHeadings(doc.content), [doc.content]);

  // heading 아이콘 클릭 핸들러(아이콘 수정 모달 오픈)
  const handleIconClick = (element: CustomElement) => {
    setIconEditTarget(element);
    setIsIconModalOpen(true);
  };

  // renderLeaf/renderElement 최적화
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);
  const renderElement = useCallback(
    (props: RenderElementProps) => (
      <Element {...props} editor={editor} onIconClick={handleIconClick} />
    ),
    [editor]
  );

  // 문서 저장 핸들러 (중복 체크/서버 전송)
  const handleSave = async () => {
    const res = await fetch(`/api/documents?all=1`);
    const allDocs = await res.json();
    if (!Array.isArray(allDocs)) {
      console.error('API 반환값이 배열이 아닙니다:', allDocs);
      alert('서버 오류: 문서 목록 조회 실패');
      return;
    }

    // 1. 같은 path 내에서 id가 다르고, title이 같은 문서가 있는지 검사
    const isDuplicate = allDocs.some(
      d =>
        String(d.path) === String(doc.path) &&
        d.title === doc.title &&
        (doc.id === undefined || d.id !== doc.id)
    );
    if (isDuplicate) {
      alert('같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.');
      return;
    }

    // 2. 저장(신규/수정 구분 없이)
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc), // doc에 id도 포함!
      });

      if (res.ok) {
        // === 기존 대표문서 연동 및 완료 처리 ===
        if (isMain && doc.path) {
          const saved = await res.json();
          const documentId = saved.id || doc.id;
          const categoriesRes = await fetch('/api/categories');
          const categories = await categoriesRes.json();
          const category = categories.find((c: any) =>
            String(c.id) === String(doc.path) ||
            String(c.name) === String(doc.path)
          );
          if (!category) {
            alert('카테고리 정보를 찾을 수 없습니다.');
            return;
          }
          await fetch(`/api/categories/${category.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id: documentId,
              name: category.name,
              parent_id: category.parent_id ?? null,
              order: category.order ?? 0,
              icon: category.icon ?? null,
            }),
          });
        }
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

  // 키 이벤트 핸들러(단축키)
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // 단축키 마크(B/I/U/취소선)
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

    // heading 블록에서 Enter시 단락 추가
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

    // info-box에서 Enter 무시
    if (event.key === 'Enter') {
      const [match] = Editor.nodes(editor, {
        match: n => SlateElement.isElement(n) && n.type === 'info-box',
      });
      if (match) {
        event.preventDefault();
        return;
      }
    }

    // heading 블록에서 Backspace로 단락 변환
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

    // info-box 바로 밑 빈 줄에서 Backspace로 info-box도 같이 제거
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
          console.warn(' Backspace prevPath 접근 실패:', e);
        }
      }
    }
  };

  // 렌더(툴바, 본문, 저장/미리보기, 목차 등)
  return (
  <div className="editor-layout">
    {/* 왼쪽: 문서 정보/저장 */}
    <div className="editor-left">
      <div className="editor-form-group">
        <label className="editor-label">문서 제목</label>
        <input
          type="text"
          value={doc.title}
          onChange={e => setDoc(prev => ({ ...prev, title: e.target.value }))}
          placeholder="문서 제목을 입력하세요"
          className="editor-input"
          required
        />
      </div>
      <div className="editor-form-group">
        <label className="editor-label">태그</label>
        <input
          type="text"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onBlur={() => {
            const tags = tagInput.split('#')
              .map(t => t.trim())
              .filter(Boolean)
              .map(t => '#' + t);
            setDoc(prev => ({ ...prev, tags }));
          }}
          placeholder="#태그1, #태그2"
          className="editor-input"
        />
      </div>
      
      <div className="editor-form-group">
        <label className="editor-label">문서 아이콘</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="text"
            value={doc.icon}
            onChange={e => setDoc(prev => ({ ...prev, icon: e.target.value }))}
            maxLength={100}
            placeholder="예: 📄  또는 이미지 URL"
            className="editor-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setIconModalOpen(true)}
            className="editor-btn"
            style={{ padding: "6px 12px", fontSize: 14 }}
          >
            <FontAwesomeIcon icon={faImage} />
          </button>
          {doc.icon?.trim() && (
            doc.icon.startsWith('http') ? (
              <img
                src={doc.icon}
                alt="문서 아이콘"
                style={{
                  width: 36, height: 36,
                  objectFit: "contain",
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 8
                }}
              />
            ) : (
              <span style={{ fontSize: 34 }}>{doc.icon}</span>
            )
          )}
          {/* 이미지 탐색기 모달 */}
          <ImageSelectModal
            open={iconModalOpen}
            onClose={() => setIconModalOpen(false)}
            onSelectImage={(url) => {
              setDoc(prev => ({ ...prev, icon: url }));
              setIconModalOpen(false);
            }}
          />
          {doc.icon && (
            <button
              type="button"
              onClick={() => setDoc(prev => ({ ...prev, icon: "" }))}
              className="editor-btn"
              style={{ padding: "4px 8px", marginLeft: 4 }}
              title="아이콘 삭제"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="editor-btn-group">
        <button onClick={handleSave} className="editor-btn-save">
          저장
        </button>
      </div>
    </div>

    {/* 가운데: 툴바(고정) + 에디터 본문(스크롤 가능) */}
    <div className="editor-center">
      <div className="editor-content-scroll">
        <Slate
          key={editorKey}
          editor={editor}
          value={doc.content.length > 0 ? doc.content : EMPTY_INITIAL_VALUE}
          onChange={newValue => {
            setDoc(prev => ({ ...prev, content: newValue }));
            if (editor.selection) selectionRef.current = editor.selection;
          }}
        >
          <div className="editor-toolbar-wrapper">
            <Toolbar selectionRef={selectionRef} />
          </div>
          <Editable
            renderLeaf={renderLeaf}
            renderElement={renderElement}
            readOnly={false}
            onKeyDown={onKeyDown}
            placeholder="문서를 작성하세요..."
            spellCheck={false}
            className="editor-slate-content"
            onBlur={() => {
              selectionRef.current = editor.selection;
            }}
          />
        </Slate>
      </div>
    </div>

    {/* 오른쪽: 목차 */}
    <div className="editor-right">
      <TableOfContents headings={headings} />
    </div>
  </div>
);
}
