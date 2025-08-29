// =============================================
// File: app/components/editor/helpers/tableDrag.ts
// =============================================
/**
 * 표 드래그 선택 전역 스토어
 * - 드래그 중 user-select:none
 * - mouseup 기본동작 차단 → 네이티브 파란 선택 방지
 * - 드래그 종료 후에도 사각형(rect)은 남김(컨텍스트 메뉴/병합/삭제에서 사용)
 * - 표 밖 클릭 또는 같은 표 내에서도 영역 밖 클릭 시 rect 해제
 * - SSR 안전(브라우저에서만 글로벌 리스너 등록)
 */

import * as React from 'react';
import { Editor, Path, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';

export type DragRect = { r0: number; c0: number; r1: number; c1: number };

type State = {
  active: boolean;
  tableKey: string | null;
  tablePath: Path | null;
  startRC: { r: number; c: number } | null;
  startXY: { x: number; y: number } | null;
  rect: DragRect | null;
  editor: Editor | null;
  prevUserSelect: string | null;
};

const S: State = {
  active: false,
  tableKey: null,
  tablePath: null,
  startRC: null,
  startXY: null,
  rect: null,
  editor: null,
  prevUserSelect: null,
};

const EVT = typeof window !== 'undefined' ? new EventTarget() : ({} as EventTarget);
const emit = () => EVT.dispatchEvent(new Event('change'));

export const tablePathKey = (p: Path) => p.join('.');

const disableUserSelect = () => {
  if (typeof document === 'undefined') return;
  if (S.prevUserSelect == null) {
    S.prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
  }
};
const restoreUserSelect = () => {
  if (typeof document === 'undefined') return;
  if (S.prevUserSelect != null) {
    document.body.style.userSelect = S.prevUserSelect;
    S.prevUserSelect = null;
  }
};

// 컨텍스트 메뉴/명령에서 읽는 전역 rect
let __rect: null | { tablePath: Path; r0:number; c0:number; r1:number; c1:number } = null;
export function getDragRect() { return __rect; }
export function clearDrag() {
  __rect = null;
  if (S.rect) { S.rect = null; emit(); }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('editor:table-drag:clear'));
  }
}

const moveHandler = (e: MouseEvent) => {
  if (!S.tableKey || !S.startXY || !S.startRC) return;
  const dist = Math.hypot(e.clientX - S.startXY.x, e.clientY - S.startXY.y);

  if (!S.active && dist < 6) return; // 임계치
  if (!S.active) {
    S.active = true;
    try { window.getSelection()?.removeAllRanges(); } catch {}
    const { r, c } = S.startRC;
    S.rect = { r0: r, c0: c, r1: r, c1: c };
    __rect = S.tablePath ? { tablePath: S.tablePath, ...S.rect } : null;
    emit();
  }
};

const upHandler = (e: MouseEvent) => {
  e.preventDefault(); // 네이티브 파란 선택 방지

  window.removeEventListener('mousemove', moveHandler, true);
  window.removeEventListener('mouseup', upHandler, true);

  const wasActive = S.active;
  const rect = S.rect;
  const editor = S.editor;
  const tablePath = S.tablePath;
  const start = S.startRC;

  S.active = false;
  S.startRC = null;
  S.startXY = null;
  S.editor = null;
  emit();

  requestAnimationFrame(() => {
    try {
      if (!editor || !tablePath) return;

      if (!wasActive && start) {
        // 클릭만 한 경우: 해당 셀 끝에 커서
        const end = Editor.end(editor, [...tablePath, start.r, start.c]);
        Transforms.select(editor, end);
        ReactEditor.focus(editor as any);
        __rect = null;
      } else if (wasActive && rect) {
        // 드래그한 경우: 커서는 rect 끝 셀에, rect는 유지
        const end = Editor.end(editor, [...tablePath, rect.r1, rect.c1]);
        Transforms.select(editor, end);
        ReactEditor.focus(editor as any);
        __rect = { tablePath, ...rect };
      }
    } catch {}
    requestAnimationFrame(() => restoreUserSelect());
  });
};

/** 드래그 시작 */
export function beginDrag(
  editor: Editor,
  tablePath: Path,
  tableKey: string,
  r: number,
  c: number,
  x: number,
  y: number
) {
  S.active = false;
  S.tableKey = tableKey;
  S.tablePath = tablePath.slice();
  S.startRC = { r, c };
  S.startXY = { x, y };
  S.editor = editor;

  __rect = null;
  disableUserSelect();
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', moveHandler, true);
    window.addEventListener('mouseup', upHandler, true);
  }
}

/** 드래그 중 hover 셀 갱신 */
export function hoverCell(tableKey: string, r: number, c: number) {
  if (!S.startRC || S.tableKey !== tableKey) return;
  if (!S.active) return;
  const r0 = Math.min(S.startRC.r, r);
  const c0 = Math.min(S.startRC.c, c);
  const r1 = Math.max(S.startRC.r, r);
  const c1 = Math.max(S.startRC.c, c);
  S.rect = { r0, c0, r1, c1 };
  __rect = S.tablePath ? { tablePath: S.tablePath, ...S.rect } : null;
  emit();
}

/** 레일 클릭용: 사각형을 직접 설정 */
export function selectRectDirect(
  editor: Editor,
  tablePath: Path,
  tableKey: string,
  r0: number, c0: number, r1: number, c1: number
) {
  S.tableKey = tableKey;
  S.tablePath = tablePath.slice();
  S.rect = { r0, c0, r1, c1 };
  __rect = { tablePath: S.tablePath, ...S.rect };
  emit();
  try {
    const end = Editor.end(editor, [...tablePath, r1, c1]);
    Transforms.select(editor, end);
    ReactEditor.focus(editor as any);
  } catch {}
}

/** 현재 테이블의 드래그 사각형 */
export function currentRectForTable(tableKey: string): DragRect | null {
  return S.rect && S.tableKey === tableKey ? { ...S.rect } : null;
}

/** 리액트 훅: 현재 사각형(테두리 계산용) */
export function useDragRect(tableKey: string) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setTick(v => (v + 1) & 1023);
    EVT.addEventListener('change', cb as any);
    return () => EVT.removeEventListener('change', cb as any);
  }, []);
  return S.tableKey === tableKey && S.rect ? { ...S.rect } : null;
}

/** 외부에서 사각형 지우기 */
export function clearRect() {
  if (S.rect) { S.rect = null; emit(); }
}

export function isDragPrimedOrActive() {
  return !!S.startRC || !!S.active;
}

/* ---------- rect 해제 규칙 ---------- */
if (typeof window !== 'undefined') {
  window.addEventListener('mousedown', (e) => {
    if (!S.rect) return;
    const td = (e.target as HTMLElement | null)?.closest('td.slate-table__cell') as HTMLElement | null;
    const key = (td?.dataset as any)?.tkey || null;
    const r = td?.dataset?.r ? parseInt(td.dataset.r, 10) : NaN;
    const c = td?.dataset?.c ? parseInt(td.dataset.c, 10) : NaN;

    if (!key || key !== S.tableKey) { clearDrag(); return; }

    if (
      Number.isFinite(r) && Number.isFinite(c) &&
      (r < S.rect!.r0 || r > S.rect!.r1 || c < S.rect!.c0 || c > S.rect!.c1)
    ) {
      clearDrag();
    }
  }, true);
}
