'use client';

import React, {
  useMemo, useState, useCallback, useEffect, useRef, useLayoutEffect
} from 'react';
import {
  createEditor, Descendant, Editor, Transforms, Range, Point,
  Element as SlateElement, Node, Path
} from 'slate';
import {
  Slate, Editable, withReact, ReactEditor,
  type RenderLeafProps, type RenderElementProps
} from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';

import { Toolbar } from './Toolbar';
import Leaf from './Leaf';
import ElementRenderer from './Element';
import TableOfContents from './TableOfContents';
import { extractHeadings } from './helpers/extractHeadings';
import type { CustomElement } from '@/types/slate';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import PriceTableEditModal from './PriceTableEditModal';
import '@/wiki/css/editor.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import TableContextMenu from './TableContextMenu';
import type { WikiRefKind } from './render/types';
import { toProxyUrl } from '@lib/cdn';
import { getDragRect } from './helpers/tableDrag';

type DocState = {
  id?: number;
  title: string;
  path: string;
  icon: string;
  tags: string[];
  content: Descendant[];
};

const EMPTY_INITIAL_VALUE: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }] }];

type Props = {
  initialDoc: DocState | null;
  isMain?: boolean;
};

type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

// 커서 진입 불가 블럭
const VOID_BLOCK_TYPES = new Set([
  'image',
  'divider',
  'price-table-card',
  'weapon-card',
  'quest-embed',
  'npc-embed',
  'qna-embed',
]);

// weapon-card / price-table-card 내부에서 Enter 눌렀을 때
// 블럭이 복사되지 않고, 블럭 뒤에 새 paragraph 를 만들도록 하는 플러그인
function withWeaponBlocks(editor: Editor): Editor {
  const e = editor;
  const { insertBreak } = e;

  e.insertBreak = () => {
    const { selection } = e;

    // 선택이 없거나 드래그 선택이면 기존 동작 그대로
    if (!selection || !Range.isCollapsed(selection)) {
      return insertBreak();
    }

    // 커서가 weapon-card / price-table-card 안에 있는지 확인
    const [match] = Editor.nodes(e, {
      match: (n) =>
        SlateElement.isElement(n) &&
        ((n as any).type === 'weapon-card' ||
          (n as any).type === 'price-table-card' ||
          (n as any).type === 'quest-embed' ||   // ✅
          (n as any).type === 'npc-embed' ||     // ✅
          (n as any).type === 'qna-embed'),
    });

    if (match) {
      const [, path] = match;

      // 카드 바로 뒤 위치
      const insertPath = Path.next(path);

      // 새 paragraph 블럭 하나 삽입
      const paragraph: Node = {
        type: 'paragraph',
        children: [{ text: '' }],
      } as any;

      Transforms.insertNodes(e, paragraph, { at: insertPath });

      // 커서를 새 paragraph 의 첫 텍스트로 이동
      const textPath = [...insertPath, 0];
      Transforms.select(e, {
        anchor: { path: textPath, offset: 0 },
        focus: { path: textPath, offset: 0 },
      });

      try {
        ReactEditor.focus(e as any);
      } catch {
        /* ignore */
      }

      return;
    }

    // 나머지는 원래 Enter 동작
    return insertBreak();
  };

  return e;
}

export default function SlateEditor({ initialDoc, isMain = false }: Props) {
  if (!initialDoc) return <div>잘못된 접근입니다.</div>;

  // ── 개발 중 스크롤 로깅(원하면 삭제) ──────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const errStack = () => (new Error().stack ?? '').split('\n').slice(0, 4).join('\n');

    const origScrollTo = window.scrollTo.bind(window);
    (window as any).scrollTo = (...args: any[]) => {
      console.log('[SCROLL] window.scrollTo', args, errStack());
      return origScrollTo(...(args as Parameters<typeof window.scrollTo>));
    };

    const DOMElementCtor: any = (globalThis as any).Element;
    const proto: any = DOMElementCtor?.prototype;
    if (!proto) {
      console.warn('[SCROLL] Element.prototype not available; skip scrollIntoView patch');
      return () => { (window as any).scrollTo = origScrollTo; };
    }

    const origSIV = proto.scrollIntoView;
    proto.scrollIntoView = function (this: Element, ...args: any[]) {
      const el = this as any as HTMLElement;
      const mark = el?.id ? `#${el.id}` : (typeof el?.className === 'string' ? el.className : '') || el?.tagName;
      console.log('[SCROLL] scrollIntoView on', mark, args, errStack());
      if (typeof origSIV === 'function') return origSIV.apply(this, args);
      return undefined;
    };

    return () => {
      (window as any).scrollTo = origScrollTo;
      proto.scrollIntoView = origSIV;
    };
  }, []);
  // ────────────────────────────────────────────────────────────

  const withCustomInline = (editor: Editor) => {
    const { isInline, isVoid } = editor;
    editor.isInline = el =>
      el.type === 'link' || el.type === 'inline-mark' || el.type === 'inline-image' ||
      (el as any).type === 'wiki-ref'
        ? true
        : isInline(el);
    editor.isVoid = el =>
      (el as any).type === 'inline-image' || VOID_BLOCK_TYPES.has((el as any).type)
        ? true
        : isVoid(el);
    return editor;
  };

  const editor = useMemo(() => {
    // ✅ 커스텀 플러그인 묶는 순서: React → History → inline/void → weapon-card 플러그인
    const e = withWeaponBlocks(
      withCustomInline(withHistory(withReact(createEditor())))
    );

    const { normalizeNode } = e;
    e.normalizeNode = ([node, path]) => {
      if (SlateElement.isElement(node) && node.type === 'info-box') {
        // 1) children이 비어있으면 최소 텍스트 1개 보장
        if (!node.children || node.children.length === 0) {
          Transforms.insertNodes(e, { text: '' } as any, { at: [...path, 0] });
          return;
        }

        // 2) ✅ info-box 안에 element(예: inline-image)가 있으면 "합치기(merge)" 금지
        const hasElementChild = node.children.some((ch: any) =>
          SlateElement.isElement(ch)
        );

        // 3) 텍스트만 있을 때에만 기존처럼 여러 텍스트를 1개로 합침
        if (!hasElementChild) {
          const text = Node.string(node);
          if (text === '') return;

          if (node.children.length > 1) {
            const merged = { ...node, children: [{ text }] };
            Transforms.removeNodes(e, { at: path });
            Transforms.insertNodes(e, merged as any, { at: path });
            return;
          }
        }
      }

      normalizeNode([node, path]);
    };

    return e;
  }, []);

  // ✅ FIX: 안전한 Path 체크/셀렉트 헬퍼 (드래그 삭제로 path가 날아가면 여기서 방어)
  const safeHasPath = useCallback((p: Path | null) => {
    if (!p) return false;
    try {
      return Editor.hasPath(editor, p);
    } catch {
      return false;
    }
  }, [editor]);

  const safeSelectPoint = useCallback((at: any) => {
    try {
      Transforms.select(editor, at);
      ReactEditor.focus(editor);
      return true;
    } catch {
      return false;
    }
  }, [editor]);

  // 상태
  const selectionRef = useRef<Range | null>(null);    // 최근 커서(에디터 onChange에서 갱신)
  const savedSelectionRef = useRef<Range | null>(null); // 모달 열기 시점 커서 저장
  const [editorKey] = useState(0);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconEditTarget, setIconEditTarget] = useState<CustomElement | null>(null);
  const [moveCursorPending, setMoveCursorPending] = useState(false);
  const [lastLinkPath, setLastLinkPath] = useState<Path | null>(null);
  const [iconModalOpen, setIconModalOpen] = useState(false);

  const [doc, setDoc] = useState<DocState>(() => ({
    id: initialDoc?.id ?? undefined,
    title: initialDoc?.title ?? '',
    path: initialDoc?.path ?? '',
    icon: initialDoc?.icon ?? '',
    tags: Array.isArray(initialDoc?.tags) ? initialDoc.tags : [],
    content: Array.isArray(initialDoc.content) && initialDoc.content.length > 0
      ? initialDoc.content
      : EMPTY_INITIAL_VALUE,
  }));

  const [iconImgError, setIconImgError] = useState(false);

  useEffect(() => {
    // 아이콘 URL이 바뀌면 에러 상태 리셋
    setIconImgError(false);
  }, [doc.icon]);

  const isImageUrl = (v: string) => {
    const s = (v ?? '').trim();
    if (!s) return false;
    // http/https 뿐 아니라 / (내부 경로), data: 도 이미지로 취급
    return /^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:');
  };

  const getIconSrc = (v: string) => {
    const s = (v ?? '').trim();
    if (!s) return '';
    // ✅ 외부 URL은 프록시 적용 (네 원칙)
    if (/^https?:\/\//i.test(s)) return toProxyUrl(s);
    // 내부 경로(/...)나 data:는 그대로
    return s;
  };

  const [priceTableEdit, setPriceTableEdit] = useState<PriceTableEditState>({
    blockPath: null, idx: null, item: null,
  });

  const [tagInput, setTagInput] = useState(doc.tags.join(', '));

  // ✳️ 에디터 스크롤 타겟(정확히 가운데 편집 영역)
  const scrollRef = useRef<HTMLDivElement>(null);

  // 실제 스크롤 컨테이너 탐지
  const getScrollEl = useCallback((): HTMLDivElement | null => {
    const fromRef = scrollRef.current;
    if (fromRef) return fromRef;

    const candidates = Array.from(document.querySelectorAll<HTMLDivElement>('.editor-content-scroll'));
    const pick = candidates.find(el => {
      const cs = getComputedStyle(el);
      const isScrollable = /(auto|scroll)/.test(cs.overflowY);
      return isScrollable && el.scrollHeight > el.clientHeight;
    });
    return pick ?? candidates[0] ?? null;
  }, []);

  // ── 가격 모달 전용 프리즈/복원 상태 ─────────────────────────
  const lastYRef = useRef(0);
  const freezeCleanupRef = useRef<(() => void) | null>(null);
  const freezeActiveRef = useRef(false);

  // (선택) 모달 열기 직전 명시적으로 Y 저장하고 싶을 때 사용
  const captureScrollPrice = useCallback(() => {
    const el = getScrollEl();
    lastYRef.current = el?.scrollTop ?? 0;
  }, [getScrollEl]);

  useEffect(() => {
    const handler = () => captureScrollPrice();
    window.addEventListener('editor:capture-scroll:price', handler as EventListener);
    return () => window.removeEventListener('editor:capture-scroll:price', handler as EventListener);
  }, [captureScrollPrice]);

  const startFreeze = useCallback(() => {
    const el = getScrollEl();
    if (!el) return;

    // 프리즈 시작 플래그
    freezeActiveRef.current = true;

    // 커서 스냅샷 저장
    try {
      if (editor.selection) {
        savedSelectionRef.current = Editor.unhangRange(editor, editor.selection);
      } else {
        savedSelectionRef.current = null;
      }
    } catch {
      savedSelectionRef.current = editor.selection ?? null;
    }

    // 기준 Y 고정
    lastYRef.current = el.scrollTop;
    const y = lastYRef.current;

    const prevScrollBehavior = el.style.scrollBehavior || '';
    el.style.scrollBehavior = 'auto';
    el.scrollTop = y;

    const onElScroll = () => { if (el.scrollTop !== y) el.scrollTop = y; };
    el.addEventListener('scroll', onElScroll, { capture: true });

    let raf = 0;
    const tick = () => {
      if (el.scrollTop !== y) el.scrollTop = y;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    freezeCleanupRef.current = () => {
      el.removeEventListener('scroll', onElScroll as any, { capture: true } as any);
      cancelAnimationFrame(raf);
      el.style.scrollBehavior = prevScrollBehavior;
    };
  }, [getScrollEl, editor]);

  const stopFreeze = useCallback(() => {
    if (!freezeActiveRef.current) return;
    freezeCleanupRef.current?.();
    freezeCleanupRef.current = null;
    freezeActiveRef.current = false;
  }, []);

  // 가격 모달이 열렸을 때만 프리즈, 닫힐 때 해제
  useLayoutEffect(() => {
    if (!priceTableEdit.blockPath) return;
    startFreeze();
    return () => stopFreeze();
  }, [priceTableEdit.blockPath, startFreeze, stopFreeze]);

  const restoreScroll = () => {
    const el = getScrollEl();
    if (el) el.scrollTop = lastYRef.current;
  };

  const focusNoScroll = useCallback(() => {
    try {
      const dom = ReactEditor.toDOMNode(editor, editor);
      (dom as HTMLElement)?.focus?.({ preventScroll: true } as any);
    } catch {}
  }, [editor]);

  const restoreCaret = useCallback(() => {
    const sel = savedSelectionRef.current;
    let restored = false;

    // ✅ 외부 인풋 진입 중에는 selection 복원하지 않고 바로 deselect
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      try { Transforms.deselect(editor); } catch {}
      savedSelectionRef.current = null;
      return;
    }

    if (sel) {
      try {
        Transforms.select(editor, sel);
        focusNoScroll();   // ← preventScroll로 포커스
        restored = true;
      } catch {
        restored = false;
      }
    }

    if (!restored) {
      const point = Editor.end(editor, []);
      Transforms.select(editor, point);
      focusNoScroll();     // ← preventScroll로 포커스
    }

    savedSelectionRef.current = null;
  }, [editor, focusNoScroll]);

  const handlePriceModalClose = () => {
    setPriceTableEdit({ blockPath: null, idx: null, item: null });
    stopFreeze();
    requestAnimationFrame(() => {
      restoreScroll();
      restoreCaret();
      const el = getScrollEl();
      if (el) lastYRef.current = el.scrollTop;
    });
  };

  const handlePriceModalSave = (data: { stages: string[]; prices: Array<string | number> }) => {
    const { blockPath, idx } = priceTableEdit;

    // 가격 값 정규화
    const normalizePrices = (arr: Array<string | number>) =>
      arr.map((v) => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const s = String(v ?? '').trim();
        return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : s;
      });

    if (blockPath && typeof idx === 'number') {
      Editor.withoutNormalizing(editor, () => {
        const entry = Editor.node(editor, blockPath) as [any, Path] | undefined;
        if (!entry) return;
        const [cardNode] = entry;

        if (cardNode && Array.isArray(cardNode.items)) {
          const nextItems = cardNode.items.map((itm: any, i: number) =>
            i === idx
              ? { ...itm, stages: [...data.stages], prices: normalizePrices(data.prices) }
              : itm
          );
          Transforms.setNodes(editor, { items: nextItems }, { at: blockPath });
        }
      });
    }

    setPriceTableEdit({ blockPath: null, idx: null, item: null });

    stopFreeze();
    requestAnimationFrame(() => {
      restoreScroll();
      restoreCaret();
      const el = getScrollEl();
      if (el) lastYRef.current = el.scrollTop;
    });
  };

  // 문서 초기값 반영
  useEffect(() => {
    setDoc({
      id: initialDoc?.id ?? undefined,
      title: initialDoc?.title ?? '',
      path: initialDoc?.path ?? '',
      icon: initialDoc?.icon ?? '',
      tags: Array.isArray(initialDoc?.tags) ? initialDoc.tags : [],
      content: Array.isArray(initialDoc?.content) && initialDoc.content.length > 0
        ? initialDoc.content
        : EMPTY_INITIAL_VALUE,
    });
  }, [initialDoc]);

  // Backspace 뒤로가기 방지
  useEffect(() => {
    const preventBackspaceNavigation = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isEditable = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (e.key === 'Backspace' && !isEditable) e.preventDefault();
    };
    window.addEventListener('keydown', preventBackspaceNavigation);
    return () => window.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  // (기존) 링크 포커스 복원은 유지
  useEffect(() => {
    if (moveCursorPending && lastLinkPath) {
      // ✅ FIX: 드래그 삭제로 lastLinkPath가 사라졌을 수 있음 → hasPath + try/catch 방어
      if (!safeHasPath(lastLinkPath)) {
        setMoveCursorPending(false);
        setLastLinkPath(null);
        return;
      }

      try {
        const after = Editor.after(editor, lastLinkPath);
        if (after) {
          safeSelectPoint(after);
        }
      } catch {
        // path/point 계산 중 예외 → 상태 정리
      } finally {
        setMoveCursorPending(false);
        setLastLinkPath(null);
      }
    }
  }, [doc.content, moveCursorPending, lastLinkPath, editor, safeHasPath, safeSelectPoint]);

  const headings = useMemo(() => extractHeadings(doc.content), [doc.content]);
  const handleIconClick = (element: CustomElement) => {
    setIconEditTarget(element);
    setIsIconModalOpen(true);
  };

  const renderLeaf = useCallback((p: RenderLeafProps) => <Leaf {...p} />, []);
  const renderElement = useCallback(
    (p: RenderElementProps) => (
      <ElementRenderer
        {...p}
        editor={editor}
        onIconClick={handleIconClick}
        priceTableEdit={priceTableEdit}
        setPriceTableEdit={setPriceTableEdit}
        readOnly={false}
        onWikiRefClick={(refType: WikiRefKind, refId: number) => {

        }}
      />
    ),
    [editor, priceTableEdit]
  );

  const handleSave = async () => {
    const pathStr = String(doc.path ?? '0');
    const titleTrim = String(doc.title ?? '').trim();

    let samePathDocs: any[] = [];
    try {
      const resList = await fetch(`/api/documents?list=1&path=${encodeURIComponent(pathStr)}`, { cache: 'no-store' });
      if (resList.ok) {
        const data = await resList.json();
        samePathDocs = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      } else {
        const resAll = await fetch(`/api/documents?all=1`, { cache: 'no-store' });
        const data = resAll.ok ? await resAll.json() : [];
        samePathDocs = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      }
    } catch { samePathDocs = []; }

    const isDuplicate = samePathDocs.some(d =>
      String(d.path) === pathStr &&
      String(d.title ?? '').trim() === titleTrim &&
      (doc.id == null || d.id !== doc.id)
    );

    if (isDuplicate) {
      let label = pathStr === '0' ? '루트 카테고리' : '해당 카테고리';
      try {
        const catsRes = await fetch('/api/categories', { cache: 'no-store' });
        if (catsRes.ok) {
          const cats = await catsRes.json();
          const cat = Array.isArray(cats)
            ? cats.find((c: any) => String(c.id) === pathStr || String(c.name) === pathStr)
            : null;
          if (cat?.name) label = cat.name;
        }
      } catch {}
      alert(`${label}에 동일한 제목의 문서가 이미 있어요.`);
      return;
    }

    try {
      const res = await fetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, title: titleTrim }),
      });
      if (!res.ok) { alert('저장 실패'); return; }

      let saved: any = null;
      try { saved = await res.json(); } catch {}
      const documentId = saved?.id ?? doc.id;

      if (isMain && doc.path != null) {
        try {
          const catsRes = await fetch('/api/categories', { cache: 'no-store' });
          if (catsRes.ok) {
            const cats = await catsRes.json();
            const category = Array.isArray(cats)
              ? cats.find((c: any) => String(c.id) === pathStr || String(c.name) === pathStr)
              : null;

            if (category) {
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
            } else if (pathStr !== '0') {
              alert('카테고리 정보를 찾을 수 없습니다.');
            }
          }
        } catch {}
      }

      alert('저장 완료!');
    } catch { alert('문서 저장 실패'); }
  };

  const isSelectionInsideTable = useCallback(() => {
    const { selection } = editor;
    if (!selection) return false;
    const cell = Editor.above(editor, {
      at: selection,
      match: n => SlateElement.isElement(n) && (n as any).type === 'table-cell',
    });
    return !!cell;
  }, [editor]);

  const buildTSVFromRect = useCallback(() => {
    const rectInfo = getDragRect();
    if (!rectInfo) return null;

    const { tablePath, r0, c0, r1, c1 } = rectInfo;
    try {
      const rows: string[] = [];
      for (let r = r0; r <= r1; r++) {
        const cols: string[] = [];
        for (let c = c0; c <= c1; c++) {
          const cellPath = [...tablePath, r, c];
          const cellNode = Node.get(editor, cellPath);
          // table-cell 안의 텍스트만
          cols.push(Node.string(cellNode).replace(/\r?\n/g, '\n'));
        }
        rows.push(cols.join('\t'));
      }
      return rows.join('\n');
    } catch {
      return null;
    }
  }, [editor]);

  const onCopyTableSafe = useCallback((e: React.ClipboardEvent) => {
    // 1) 엑셀식 드래그(rect)가 남아있다면: 그 영역을 TSV로 복사
    const tsv = buildTSVFromRect();
    if (tsv != null) {
      e.preventDefault();
      e.stopPropagation();
      e.clipboardData.setData('text/plain', tsv);
      // ✅ html은 일부러 안 넣음 (td 복사 방지)
      return;
    }

    // 2) 일반 텍스트 드래그 선택인데 table-cell 내부라면: text/plain만
    if (!isSelectionInsideTable()) return;

    const { selection } = editor;
    if (!selection) return;

    const text = Editor.string(editor, selection);
    e.preventDefault();
    e.stopPropagation();
    e.clipboardData.setData('text/plain', text);
  }, [editor, buildTSVFromRect, isSelectionInsideTable]);

  const SLATE_FRAG_PREFIX = '__RDWIKI_SLATE_FRAGMENT__=';

  const decodeSlateFragment = (encoded: string) => {
    const json = decodeURIComponent(window.atob(encoded));
    return JSON.parse(json);
  };

  const onPasteTableSafe = useCallback((e: React.ClipboardEvent) => {
    if (!isSelectionInsideTable()) return;

    const text = e.clipboardData.getData('text/plain') || '';

    // ✅ 0) 우리 컨텍스트메뉴 복사 토큰이면: 직접 fragment 삽입 (inline-image 포함)
    if (text.startsWith(SLATE_FRAG_PREFIX)) {
      e.preventDefault();
      e.stopPropagation();

      const firstLineEnd = text.indexOf('\n');
      const header = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text;
      const encoded = header.slice(SLATE_FRAG_PREFIX.length).trim();

      try {
        const fragment = decodeSlateFragment(encoded);
        // fragment는 "셀 내부 children 배열"이므로 그대로 insertFragment 가능
        Transforms.insertFragment(editor, fragment);
      } catch {
        // 디코딩 실패면 그냥 남은 텍스트라도 넣기
        const fallback = firstLineEnd >= 0 ? text.slice(firstLineEnd + 1) : '';
        if (fallback) Transforms.insertText(editor, fallback);
      }
      return;
    }

    // ✅ 1) 외부 표 HTML만 차단 (기존 로직 유지)
    const html = e.clipboardData.getData('text/html') || '';
    const hasTableHtml = /<(table|tbody|tr|td|th)\b/i.test(html);
    if (hasTableHtml) {
      e.preventDefault();
      e.stopPropagation();
      Transforms.insertText(editor, text);
    }
  }, [editor, isSelectionInsideTable]);

  const openInlineImageModalRef = useRef<(() => void) | null>(null);

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
        Transforms.setNodes(editor, { [format]: true } as any, {
          match: n => SlateElement.isElement(n) && Editor.isInline(editor, n),
        });
      }

      if (isHotkey('mod+shift+e', event)) {
        event.preventDefault();
        openInlineImageModalRef.current?.();
        return;
      }
    }

    // heading에서 Enter → 아래에 paragraph (기존)
    if (event.key === 'Enter') {
      const [matchH] = Editor.nodes(editor, {
        match: n =>
          SlateElement.isElement(n) &&
          ['heading-one', 'heading-two', 'heading-three'].includes(n.type),
      });
      if (matchH) {
        event.preventDefault();
        Transforms.insertNodes(
          editor,
          { type: 'paragraph', children: [{ text: '' }] } as any,
        );
        return;
      }
    }

    // info-box 안에서는 Enter → 같은 박스 안에서 줄바꿈(개행) 처리
    // - 기본 Enter: \n 삽입 (박스 내부 여러 줄)
    // - (선택) Ctrl/Cmd+Enter: 박스 바깥으로 빠져나와 새 paragraph 생성
    if (event.key === 'Enter') {
      const ibEntry = Editor.above(editor, {
        match: n => SlateElement.isElement(n) && (n as any).type === 'info-box',
      });

      if (ibEntry) {
        event.preventDefault();

        // Ctrl/Cmd+Enter: 박스 밖으로 나가기 (원하면 유지)
        if (event.ctrlKey || event.metaKey) {
          const [, ibPath] = ibEntry;
          const insertPath = Path.next(ibPath);

          Transforms.insertNodes(
            editor,
            { type: 'paragraph', children: [{ text: '' }] } as any,
            { at: insertPath },
          );

          Transforms.select(editor, Editor.start(editor, insertPath));
          ReactEditor.focus(editor);
          return;
        }

        // 기본 Enter: 박스 내부에서 줄바꿈
        Transforms.insertText(editor, '\n');
        return;
      }
    }

    // ⭐ 무기 카드 / 시세표 카드 뒤 "빈 단락"에서 Enter 처리
    //    → 카드 복사하지 않고, 그 아래에 새 paragraph 하나 추가
    if (event.key === 'Enter' && !event.shiftKey) {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        try {
          const [block, blockPath] = Editor.node(editor, selection, {
            depth: 1,
          });

          const isEmptyParagraph =
            SlateElement.isElement(block) &&
            (block as any).type === 'paragraph' &&
            Node.string(block) === '';

          if (isEmptyParagraph && blockPath[0] > 0) {
            const prevPath: Path = [blockPath[0] - 1];

            let prevNode: Node | null = null;
            try {
              prevNode = Node.get(editor, prevPath);
            } catch {
              prevNode = null;
            }

            if (
              prevNode &&
              SlateElement.isElement(prevNode) &&
              ['weapon-card', 'price-table-card', 'quest-embed', 'npc-embed', 'qna-embed'].includes(
                (prevNode as any).type,
              )
            ) {
              event.preventDefault();

              const insertPath = Path.next(blockPath);
              const paragraph: any = {
                type: 'paragraph',
                children: [{ text: '' }],
              };

              Transforms.insertNodes(editor, paragraph, { at: insertPath });
              Transforms.select(editor, Editor.start(editor, insertPath));
              ReactEditor.focus(editor);
              return;
            }
          }
        } catch {
          // 실패 시엔 그냥 기본 동작으로 넘어가도록 둠
        }
      }
    }

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
            Transforms.insertNodes(
              editor,
              { type: 'paragraph', children: [{ text: '' }] } as any,
            );
            const point = Editor.start(editor, [0]);
            Transforms.select(editor, point);
          }
        }
      }
    }

    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [currentBlock] = Editor.nodes(editor, {
          match: n =>
            SlateElement.isElement(n) && Editor.isBlock(editor, n),
        });
        if (!currentBlock) return;
        const [, currentPath] = currentBlock;
        if (currentPath[0] === 0) return;
        const prevPath = Path.previous(currentPath);
        try {
          const prevNode = Node.get(editor, prevPath);
          if (
            SlateElement.isElement(prevNode) &&
            prevNode.type === 'info-box'
          ) {
            const isEmpty =
              Node.string(currentBlock[0]).length === 0;
            if (isEmpty) {
              event.preventDefault();
              Transforms.removeNodes(editor, { at: currentPath });
              Transforms.removeNodes(editor, { at: prevPath });
              const newPath = prevPath[0] > 0 ? [prevPath[0] - 1] : [0];
              const point = Editor.end(editor, newPath);
              Transforms.select(editor, point);
              ReactEditor.focus(editor);
              return;
            }
          }
        } catch {}
      }
    }

    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [node, path] = Editor.node(editor, selection, {
          depth: 1,
        });
        const isEmpty =
          SlateElement.isElement(node) &&
          node.type === 'paragraph' &&
          Node.string(node) === '';
        if (isEmpty && path[0] > 0) {
          const prevPath = [path[0] - 1];
          const prevNode = Node.get(editor, prevPath);
          if (
            SlateElement.isElement(prevNode) &&
            prevNode.type === 'price-table-card'
          ) {
            event.preventDefault();
            return;
          }
        }
      }
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      Transforms.splitNodes(editor, { always: true });
      const marks = Editor.marks(editor) || {};
      Object.keys(marks).forEach(m =>
        Editor.removeMark(editor, m as any),
      );
      const { selection } = editor;
      if (selection) {
        const [block, path] = Editor.node(editor, selection, {
          depth: 1,
        });
        if (SlateElement.isElement(block)) {
          const patch: any = {};
          if ('indentLine' in block) patch.indentLine = false;
          if ('textAlign' in block) patch.textAlign = undefined;
          if (Object.keys(patch).length > 0)
            Transforms.setNodes(editor, patch, { at: path });
        }
      }
      return;
    }

    const { selection } = editor;
    if (
      selection &&
      Range.isCollapsed(selection) &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        event.key,
      )
    ) {
      const backward =
        event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      const neighborPoint = backward
        ? Editor.before(editor, selection, { unit: 'block' })
        : Editor.after(editor, selection, { unit: 'block' });
      if (neighborPoint) {
        const entry = Editor.above(editor, {
          at: neighborPoint,
          match: n =>
            SlateElement.isElement(n) && Editor.isBlock(editor, n),
        });
        if (entry) {
          const [node, path] = entry;
          const type = (node as any).type;
          if (type === 'link-block-row' || VOID_BLOCK_TYPES.has(type)) {
            event.preventDefault();
            const target = backward
              ? Editor.before(editor, path)
              : Editor.after(editor, path);
            if (target) {
              Transforms.select(editor, target);
              ReactEditor.focus(editor);
            }
            return;
          }
        }
      }
    }
  };

  return (
    <>
      <div className="editor-layout">
        <div className="editor-left">
          <div className="meta-card">
            <div className="meta-title">문서 정보</div>

            {/* 문서 제목 */}
            <div className="meta-field">
              <label className="meta-label">문서 제목</label>
              <input
                type="text"
                className="meta-input"
                placeholder="문서 제목을 입력하세요"
                value={doc.title}
                onChange={e => setDoc(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            {/* 태그 */}
            <div className="meta-field">
              <label className="meta-label">태그</label>
              <input
                type="text"
                className="meta-input"
                placeholder="#태그1 #태그2"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onBlur={() => {
                  const tags = tagInput.split('#').map(t => t.trim()).filter(Boolean).map(t => '#' + t);
                  setDoc(prev => ({ ...prev, tags }));
                }}
              />
            </div>

            {/* 문서 아이콘 */}
            <div className="meta-field">
              <label className="meta-label">문서 아이콘</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  className="meta-input"
                  style={{ flex: 1 }}
                  maxLength={100}
                  placeholder=""
                  value={doc.icon}
                  onChange={e => setDoc(prev => ({ ...prev, icon: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setIconModalOpen(true)}
                  className="editor-toolbar-btn-plain"
                  style={{ padding: '6px 10px', borderRadius: 10 }}
                  title="이미지 선택"
                >
                  <FontAwesomeIcon icon={faImage} />
                </button>

                {doc.icon?.trim() && (
                  isImageUrl(doc.icon) ? (
                    iconImgError ? (
                      // 이미지 로딩 실패 시: 텍스트로 fallback (깨진 아이콘 방지)
                      <span style={{ fontSize: 34, lineHeight: 1 }}>🖼️</span>
                    ) : (
                      <img
                        src={getIconSrc(doc.icon)}
                        alt="문서 아이콘"
                        width={36}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={() => setIconImgError(true)}
                        style={{
                          width: 36,
                          height: 36,
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: 'transparent',
                          border: '1px solid #e5e7eb',
                        }}
                      />
                    )
                  ) : (
                    <span style={{ fontSize: 34, lineHeight: 1 }}>{doc.icon}</span>
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
                    onClick={() => setDoc(prev => ({ ...prev, icon: '' }))}
                    className="editor-toolbar-btn-plain"
                    style={{ padding: '6px 8px', borderRadius: 10 }}
                    title="아이콘 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* 저장 */}
            <button className="meta-save" onClick={handleSave}>저장</button>
          </div>
        </div>

        <div className="editor-center">
          <div
            className="editor-content-scroll"
            ref={scrollRef}
            style={{
              position: 'relative',
              overscrollBehavior: 'contain' as any,
              overflowAnchor: 'none' as any, // ✅ 앵커링 끔
            }}
          >
            <Slate
              key={editorKey}
              editor={editor}
              value={doc.content.length > 0 ? doc.content : EMPTY_INITIAL_VALUE}
              onChange={newValue => {
                setDoc(prev => ({ ...prev, content: newValue }));

                // ✅ (미세 방어) selection이 존재해도 예외 케이스에서 깨지는 라이브러리 버전이 있어서 방어
                try {
                  if (editor.selection) selectionRef.current = editor.selection;
                  else selectionRef.current = null;
                } catch {
                  selectionRef.current = null;
                }
              }}
            >
              <div className="editor-toolbar-wrapper">
                <Toolbar
                  selectionRef={selectionRef}
                  openInlineImageModalRef={openInlineImageModalRef}
                />
              </div>
              <Editable
                renderLeaf={renderLeaf}
                renderElement={renderElement}
                readOnly={false}
                style={{
                  fontFamily: "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                  fontSize: '19px',
                }}
                onKeyDown={onKeyDown}
                placeholder="문서를 작성하세요..."
                spellCheck={false}
                className="editor-slate-content"
                onBlur={() => { selectionRef.current = editor.selection; }}
                onCopy={onCopyTableSafe}
                onCut={onCopyTableSafe}   // 잘라내기도 동일하게 처리 (원하면 분리 가능)
                onPaste={onPasteTableSafe}
              />
            </Slate>
          </div>
        </div>

        <div className="editor-right">
          <TableOfContents headings={headings} />
        </div>
      </div>

      {/* ✅ 모달은 스크롤 컨테이너 밖에서 렌더 */}
      {priceTableEdit.blockPath && typeof priceTableEdit.idx === 'number' && priceTableEdit.item && (
        <PriceTableEditModal
          open={true}
          item={priceTableEdit.item}
          onClose={handlePriceModalClose}
          onSave={handlePriceModalSave}
        />
      )}
      <TableContextMenu editor={editor} />
    </>
  );
}