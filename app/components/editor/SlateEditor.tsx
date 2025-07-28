// =============================================
// File: app/components/editor/SlateEditor.tsx
// =============================================
/**
 * Slate 기반 문서 에디터 컴포넌트
 * - 문서 메타데이터, 본문, 태그, 아이콘 등 상태 관리
 * - 툴바/에디터/목차/저장 등 전체 에디터 기능 포함
 * - 커스텀 블록/인라인 지원, priceTable 등 특수 UI 모달 연동
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
import ImageSelectModal from '@/components/image/ImageSelectModal';
import PriceTableEditModal from './PriceTableEditModal';
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

type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

export default function SlateEditor({ initialDoc, isMain = false }: Props) {
  if (!initialDoc) return <div>잘못된 접근입니다.</div>;

  // Slate 커스텀 인라인 요소 설정
  const withCustomInline = (editor: Editor) => {
    const { isInline } = editor;
    editor.isInline = element =>
      element.type === 'link' ||
      element.type === 'inline-mark' ||
      element.type === 'inline-image'
        ? true
        : isInline(element);
    return editor;
  };

  // 에디터 인스턴스 생성, info-box 블록 텍스트 복구 지원
  const editor = useMemo(() => {
    const e = withCustomInline(withHistory(withReact(createEditor())));
    const { normalizeNode } = e;
    e.normalizeNode = ([node, path]) => {
      if (SlateElement.isElement(node) && node.type === 'info-box') {
        const text = Node.string(node);
        if (text === '') return;
        if (node.children.length > 1) {
          const merged = {
            ...node,
            children: [{ text }],
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

  // 커서 위치 Ref, 에디터 상태
  const selectionRef = useRef<Range | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconEditTarget, setIconEditTarget] = useState<CustomElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [moveCursorPending, setMoveCursorPending] = useState(false);
  const [lastLinkPath, setLastLinkPath] = useState<Path | null>(null);
  const [iconModalOpen, setIconModalOpen] = useState(false);

  // 문서 데이터 상태, 최초 마운트/문서 변경 시 초기화
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

  // priceTableCard 편집 모달 상태
  const [priceTableEdit, setPriceTableEdit] = useState<PriceTableEditState>({
    blockPath: null,
    idx: null,
    item: null,
  });

  // 태그 input 상태
  const [tagInput, setTagInput] = useState(doc.tags.join(', '));
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);

  // priceTable 모달 열릴 때 스크롤 위치 저장/복원
  useEffect(() => {
    if (priceTableEdit.blockPath)
      lastScrollTopRef.current = scrollRef.current?.scrollTop || 0;
  }, [priceTableEdit.blockPath]);
  const restoreScroll = () => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = lastScrollTopRef.current;
  };
  const handlePriceModalClose = () => {
    setPriceTableEdit({ blockPath: null, idx: null, item: null });
    setTimeout(restoreScroll, 60);
  };
  const handlePriceModalSave = (data: { stages: string[]; prices: number[] }) => {
    if (priceTableEdit.blockPath && typeof priceTableEdit.idx === 'number' && priceTableEdit.item) {
      const newContent = JSON.parse(JSON.stringify(doc.content));
      const cardBlock: any = Node.get({ children: newContent } as any, priceTableEdit.blockPath!);
      if (cardBlock && Array.isArray(cardBlock.items)) {
        cardBlock.items = cardBlock.items.map((itm: any, i: number) =>
          i === priceTableEdit.idx!
            ? { ...itm, stages: data.stages, prices: data.prices }
            : { ...itm }
        );
        setDoc(prev => ({ ...prev, content: newContent }));
        setEditorKey(k => k + 1);
      }
    }
    setPriceTableEdit({ blockPath: null, idx: null, item: null });
    setTimeout(restoreScroll, 60);
  };

  // 문서 초기값 반영
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

  // 브라우저 백스페이스 뒤로가기 방지
  useEffect(() => {
    const preventBackspaceNavigation = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (e.key === 'Backspace' && !isEditable) e.preventDefault();
    };
    window.addEventListener('keydown', preventBackspaceNavigation);
    return () => window.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  // 링크 등에서 포커스 복원
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

  // 목차(heading) 추출
  const headings = useMemo(() => extractHeadings(doc.content), [doc.content]);

  // heading 아이콘 클릭 핸들러
  const handleIconClick = (element: CustomElement) => {
    setIconEditTarget(element);
    setIsIconModalOpen(true);
  };

  // 리프/엘리먼트 렌더러
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);
  const renderElement = useCallback(
    (props: RenderElementProps) => (
      <Element
        {...props}
        editor={editor}
        onIconClick={handleIconClick}
        priceTableEdit={priceTableEdit}
        setPriceTableEdit={setPriceTableEdit}
      />
    ),
    [editor, priceTableEdit, setPriceTableEdit]
  );

  // 문서 저장 핸들러
  const handleSave = async () => {
    const res = await fetch(`/api/documents?all=1`);
    const allDocs = await res.json();
    if (!Array.isArray(allDocs)) {
      alert('서버 오류: 문서 목록 조회 실패');
      return;
    }
    // 같은 경로/제목 중복 체크
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
    // 저장(신규/수정)
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (res.ok) {
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
        alert('저장 실패');
      }
    } catch (err) {
      alert('문서 저장 실패');
    }
  };

  // 에디터 키 이벤트(단축키/블록 커스텀 등) 
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
          { match: n => SlateElement.isElement(n) && Editor.isInline(editor, n) }
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

    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        // 현재 블럭의 경로
        const [currentNode, currentPath] = Editor.node(editor, selection, { depth: 1 });
        // 현재 블럭이 "빈 단락"
        const isEmpty = SlateElement.isElement(currentNode) && currentNode.type === 'paragraph' && Node.string(currentNode) === '';
        if (isEmpty && currentPath[0] > 0) {
          // 이전 블럭
          const prevPath = [currentPath[0] - 1];
          const prevNode = Node.get(editor, prevPath);
          if (SlateElement.isElement(prevNode) && prevNode.type === 'price-table-card') {
            // 시세 블럭 바로 뒤에서 백스페이스 → 방지
            event.preventDefault();
            return;
          }
        }
      }
    }
    
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();

      // 현재 위치에서 블록 분할 (커서가 아래 새 블록으로 이동)
      Transforms.splitNodes(editor, { always: true });

      // (옵션) soft break 삽입 필요시: editor.insertText('\n'); // 보통 splitNodes만 하면 새 줄이 생김

      // 새 블록에 마크 제거
      Object.keys(Editor.marks(editor) || {}).forEach(mark => {
        editor.removeMark(mark);
      });

      // 새 블록의 모든 속성 해제 (indentLine, textAlign 등)
      const { selection } = editor;
      if (selection) {
        // 이제 selection이 **아래 새 블록**에 위치함
        const [block, path] = Editor.node(editor, selection, { depth: 1 });
        if (SlateElement.isElement(block)) {
          const patch: any = {};
          if ('indentLine' in block) patch.indentLine = false;
          if ('textAlign' in block) patch.textAlign = undefined;
          // 다른 블록 속성도 필요하면 여기서 추가
          if (Object.keys(patch).length > 0) {
            Transforms.setNodes(editor, patch, { at: path });
          }
        }
      }
      return;
    }

    const { selection } = editor;

    if (
      selection &&
      Range.isCollapsed(selection) &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      let nextPoint: Point | undefined = undefined;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextPoint = Editor.before(editor, selection, { unit: "block" });
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextPoint = Editor.after(editor, selection, { unit: "block" });
      }

      if (typeof nextPoint !== "undefined") {
        const [node] = Editor.node(editor, nextPoint, { depth: 1 });
        if (
          SlateElement.isElement(node) &&
          node.type === "link-block-row"
        ) {
          event.preventDefault();
          return;
        }
      }
    }
  };

  // 렌더(툴바, 본문, 저장/미리보기, 목차 등)
  return (
    <>
      <div className="editor-layout">
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

        <div className="editor-center">
          <div className="editor-content-scroll" style={{ position: 'relative' }} ref={scrollRef}>
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
            {priceTableEdit.blockPath && typeof priceTableEdit.idx === 'number' && priceTableEdit.item && (
              <PriceTableEditModal
                open={true}
                item={priceTableEdit.item}
                onClose={handlePriceModalClose}
                onSave={handlePriceModalSave}
              />
            )}
          </div>
        </div>

        <div className="editor-right">
          <TableOfContents headings={headings} />
        </div>
      </div>
    </>
  );
}