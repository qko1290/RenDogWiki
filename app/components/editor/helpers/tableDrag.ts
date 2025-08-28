// =============================================
// File: app/components/editor/helpers/tableDrag.ts
// =============================================
/**
 * 표 셀 드래그 선택 전역 스토어
 * - mousedown 에서 beginDrag() 호출 → 기본 selection 차단(user-select:none)
 * - 임계치(6px) 넘으면 드래그 모드 진입 + 초록 하이라이트
 * - mouseup:
 *   - 드래그 X  : 클릭으로 간주 → 해당 셀 텍스트 leaf로 커서 이동
 *   - 드래그 O  : 드래그 사각형 범위로 Slate selection 설정
 * - 모든 경우 상태/하이라이트/DOM 스타일 복구
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

const EVT = new EventTarget();
const emit = () => EVT.dispatchEvent(new Event('change'));

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

  if (!S.active && dist < 6) return;           // 임계치(6px)
  if (!S.active) {
    S.active = true;
    // 첫 진입시 브라우저 selection 흔적 제거
    try { window.getSelection()?.removeAllRanges(); } catch {}
    const { r, c } = S.startRC;
    S.rect = { r0: r, c0: c, r1: r, c1: c };
    emit();
  }
  // 실제 사각형 갱신은 각 <td>의 hoverCell()에서 처리
};

const upHandler = (e: MouseEvent) => {
  removeEventListener('mousemove', moveHandler, true);
  removeEventListener('mouseup', upHandler, true);

  const wasActive = S.active;
  const rect = S.rect;
  const editor = S.editor;
  const tablePath = S.tablePath;
  const start = S.startRC;

  // 상태를 먼저 초기화(하이라이트 제거)
  S.active = false;
  S.tableKey = null;
  S.tablePath = null;
  S.startRC = null;
  S.startXY = null;
  S.rect = null;
  S.editor = null;
  emit();
  restoreUserSelect();

  if (!editor || !tablePath || !start) return;

  // Slate selection 확정은 다음 프레임에서(내장 mouseup 처리 이후)
  requestAnimationFrame(() => {
    try {
      if (!wasActive) {
        // 드래그 없이 클릭 → 해당 셀의 마지막 leaf로 커서 이동
        const end = Editor.end(editor, [...tablePath, start.r, start.c]);
        Transforms.select(editor, end);
        ReactEditor.focus(editor as any);
      } else if (rect) {
        // 드래그 → 사각형 범위로 selection
        const anchor = Editor.start(editor, [...tablePath, rect.r0, rect.c0]);
        const focus  = Editor.end(  editor, [...tablePath, rect.r1, rect.c1]);
        Transforms.select(editor, { anchor, focus });
        ReactEditor.focus(editor as any);
      }
    } catch {}
  });
};

/** 표 Path → key */
export const tablePathKey = (p: Path) => p.join('.');

/** mousedown 시작: 기본 selection 차단, 상태 세팅 */
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
  S.rect = null;
  S.editor = editor;

  disableUserSelect();
  // 캡처 단계에서 먼저 받도록(일부 브라우저에서 더 안정적)
  addEventListener('mousemove', moveHandler, true);
  addEventListener('mouseup', upHandler, true);
}

/** 드래그 중 다른 셀로 진입했을 때 호출 */
export function hoverCell(tableKey: string, r: number, c: number) {
  if (!S.active || S.tableKey !== tableKey || !S.startRC) return;
  const r0 = Math.min(S.startRC.r, r);
  const c0 = Math.min(S.startRC.c, c);
  const r1 = Math.max(S.startRC.r, r);
  const c1 = Math.max(S.startRC.c, c);
  S.rect = { r0, c0, r1, c1 };
  emit();
}

/** 셀이 현재 rect 안인지 여부 (하이라이트 표시용) */
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
