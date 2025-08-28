// =============================================
// File: app/components/editor/helpers/tableDrag.ts
// =============================================
/**
 * 표 드래그 선택 전역 스토어
 * - 드래그 중 user-select:none
 * - mouseup 기본동작 차단 → 파란 기본 선택 방지
 * - 드래그가 끝난 뒤엔 에디터 selection은 "단일 커서"로만 두고,
 *   사각형(rect)은 별도로 유지(컨텍스트 메뉴/병합용)
 * - 표 밖/선택 외 영역 클릭 시 rect 자동 해제
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
  rect: DragRect | null;          // ← 드래그 종료 후에도 남김
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

const EVT = new EventTarget();
const emit = () => EVT.dispatchEvent(new Event('change'));

export const tablePathKey = (p: Path) => p.join('.');

const disableUserSelect = () => {
  if (S.prevUserSelect == null) {
    S.prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
  }
};
const restoreUserSelect = () => {
  if (S.prevUserSelect != null) {
    document.body.style.userSelect = S.prevUserSelect;
    S.prevUserSelect = null;
  }
};

const moveHandler = (e: MouseEvent) => {
  if (!S.tableKey || !S.startXY || !S.startRC) return;
  const dist = Math.hypot(e.clientX - S.startXY.x, e.clientY - S.startXY.y);

  if (!S.active && dist < 6) return; // 임계치
  if (!S.active) {
    S.active = true;
    try { window.getSelection()?.removeAllRanges(); } catch {}
    const { r, c } = S.startRC;
    S.rect = { r0: r, c0: c, r1: r, c1: c };
    emit();
  }
};

const upHandler = (e: MouseEvent) => {
  // ★ 기본 파란 선택 방지
  e.preventDefault();

  removeEventListener('mousemove', moveHandler, true);
  removeEventListener('mouseup', upHandler, true);

  const wasActive = S.active;
  const rect = S.rect;
  const editor = S.editor;
  const tablePath = S.tablePath;
  const start = S.startRC;

  // 드래그 상태만 종료(사각형은 유지)
  S.active = false;
  S.startRC = null;
  S.startXY = null;
  S.editor = null;
  emit();

  // selection 적용은 다음 프레임 이후(네이티브 selection과 타이밍 충돌 방지)
  requestAnimationFrame(() => {
    try {
      if (!editor || !tablePath) return;

      if (!wasActive && start) {
        // 클릭만 한 경우: 해당 셀 끝에 커서
        const end = Editor.end(editor, [...tablePath, start.r, start.c]);
        Transforms.select(editor, end);
        ReactEditor.focus(editor as any);
      } else if (wasActive && rect) {
        // 드래그한 경우: 파란 드래그를 없애기 위해 "단일 커서"만 남김
        const end = Editor.end(editor, [...tablePath, rect.r1, rect.c1]);
        Transforms.select(editor, end);
        ReactEditor.focus(editor as any);
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

  disableUserSelect();
  addEventListener('mousemove', moveHandler, true);
  addEventListener('mouseup', upHandler, true);
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
  emit();
}

/** 현재 테이블의 드래그 사각형 */
export function currentRectForTable(tableKey: string): DragRect | null {
  return S.rect && S.tableKey === tableKey ? { ...S.rect } : null;
}

/** 리액트 훅: 셀 하이라이트 표시 여부 */
export function useCellDragHighlight(tableKey: string, r: number, c: number) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setTick(v => (v + 1) & 1023);
    EVT.addEventListener('change', cb);
    return () => EVT.removeEventListener('change', cb);
  }, []);
  if (!S.rect || S.tableKey !== tableKey) return false;
  return r >= S.rect.r0 && r <= S.rect.r1 && c >= S.rect.c0 && c <= S.rect.c1;
}

/** 리액트 훅: 현재 사각형(테두리 계산용) */
export function useDragRect(tableKey: string) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setTick(v => (v + 1) & 1023);
    EVT.addEventListener('change', cb);
    return () => EVT.removeEventListener('change', cb);
  }, []);
  return S.tableKey === tableKey && S.rect ? { ...S.rect } : null;
}

/** 외부에서 사각형 지우기 */
export function clearRect() {
  if (S.rect) { S.rect = null; emit(); }
}

/* ---------- 선택 해제 규칙 ----------
   - 표 밖 클릭 → rect 해제
   - 같은 표 안이라도 rect가 있고, rect 영역 밖의 셀 클릭 → 해제
------------------------------------ */
addEventListener('mousedown', (e) => {
  if (!S.rect) return;
  const td = (e.target as HTMLElement | null)?.closest('td.slate-table__cell') as HTMLElement | null;
  const key = td?.dataset?.tkey || null;
  const r = td?.dataset?.r ? parseInt(td.dataset.r, 10) : NaN;
  const c = td?.dataset?.c ? parseInt(td.dataset.c, 10) : NaN;

  // 표 바깥이거나(키 없음), 다른 표 → 해제
  if (!key || key !== S.tableKey) { clearRect(); return; }

  // 같은 표지만, 선택 영역 밖 → 해제
  if (
    Number.isFinite(r) && Number.isFinite(c) &&
    (r < S.rect!.r0 || r > S.rect!.r1 || c < S.rect!.c0 || c > S.rect!.c1)
  ) {
    clearRect();
  }
}, true);
