// =============================================
// File: app/components/editor/TablePicker.tsx
// =============================================
/**
 * 6x6 고정 테이블 그리드 선택 팝오버 (body 포탈, 화면 가장자리 자동 뒤집기 + 클램프)
 */

'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onPick: (rows: number, cols: number) => void;
};

const MAX = 6;

export default function TablePicker({ anchor, open, onClose, onPick }: Props) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 위치 계산 (오른쪽/아래 오버플로우 시 자동 뒤집기 & 클램프)
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const CELL = 24; // px
    const PAD = 14;
    const width = PAD * 2 + CELL * MAX;
    const height = PAD * 2 + CELL * MAX + 20; // caption

    let left = rect.left;
    let top = rect.bottom + 6;

    // 우측 오버플로우면 왼쪽으로 붙임
    if (left + width > window.innerWidth - 8) left = Math.max(8, rect.right - width);
    // 하단 오버플로우면 위로 붙임
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);

    setPos({ top, left });

    // 렌더 후 실제 크기 기준 마지막 클램프 (폰트/스케일 영향 대비)
    requestAnimationFrame(() => {
      const box = popRef.current?.getBoundingClientRect();
      if (!box) return;
      let finalLeft = left;
      let finalTop = top;
      if (finalLeft + box.width > window.innerWidth - 8) finalLeft = Math.max(8, window.innerWidth - 8 - box.width);
      if (finalTop + box.height > window.innerHeight - 8) finalTop = Math.max(8, window.innerHeight - 8 - box.height);
      if (finalLeft !== left || finalTop !== top) setPos({ top: finalTop, left: finalLeft });
    });
  }, [open, anchor]);

  // 외부 클릭/ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (e.target instanceof Node && popRef.current.contains(e.target)) return;
      if (anchor && anchor.contains(e.target as Node)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('mousedown', onDown);
    addEventListener('keydown', onEsc);
    return () => { removeEventListener('mousedown', onDown); removeEventListener('keydown', onEsc); };
  }, [open, anchor, onClose]);

  const grid = useMemo(
    () => Array.from({ length: MAX }, (_, r) => Array.from({ length: MAX }, (_, c) => [r + 1, c + 1] as [number, number])),
    []
  );

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      className="table-picker-popover"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
      role="dialog"
      aria-label="표 크기 선택"
    >
      <div className="table-picker-grid">
        {grid.map((row, r) => (
          <div key={r} className="table-picker-row">
            {row.map(([rr, cc]) => {
              const sel = hover && rr <= hover[0] && cc <= hover[1];
              return (
                <button
                  key={cc}
                  type="button"
                  className={`table-picker-cell${sel ? ' selected' : ''}`}
                  onMouseEnter={() => setHover([rr, cc])}
                  onClick={() => { onPick(rr, cc); onClose(); }}
                  aria-label={`${rr} x ${cc}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="table-picker-caption">
        {hover ? `${hover[0]} × ${hover[1]}` : '1 × 1'}
      </div>
    </div>,
    document.body
  );
}
