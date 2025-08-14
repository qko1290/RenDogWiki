// =============================================
// File: app/components/editor/PriceTableInsertModal.tsx
// =============================================
'use client';

/**
 * 시세표 카드 삽입 모달
 * - 한 줄에 표시할 카드 개수(1~5) 선택 후 삽입
 * - 툴바 드롭다운 자동 닫기 이벤트 발행
 * - 마우스/키보드(←/→, Enter) 모두 지원
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ModalCard } from '@/components/common/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (cardsPerRow: number) => void;
};

const MIN = 1;
const MAX = 5;

/** 시세표 카드 삽입 모달 – 한 줄 카드 개수 선택 */
export default function PriceTableInsertModal({ open, onClose, onInsert }: Props) {
  const [count, setCount] = useState(3);

  // 모달 열릴 때 에디터 툴바 드롭다운 닫기
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [open]);

  const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));

  const handleInsert = useCallback(() => {
    onInsert(clamp(count)); // 안전 범위 보장
  }, [count, onInsert]);

  // 키보드: ←/→로 선택 변경, Enter로 확정
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCount((c) => clamp(c - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCount((c) => clamp(c + 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  };

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="시세표 카드 삽입"
      width={420}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>취소</button>
          <button className="rd-btn primary" onClick={handleInsert}>삽입</button>
        </>
      }
    >
      <div style={{ fontSize: 15, color: '#475569', marginBottom: 10 }}>
        한 줄에 표시할 카드 개수를 선택하세요.
      </div>

      <div
        role="group"
        aria-label="카드 개수 선택"
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
        onKeyDown={onKeyDown}
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            className="rd-btn"
            onClick={() => setCount(v)}
            aria-pressed={count === v}
            style={{
              minWidth: 56,
              height: 36,
              borderRadius: 10,
              background: count === v ? '#2563eb' : '#f3f4f6',
              color: count === v ? '#fff' : '#475569',
              fontWeight: 800,
            }}
          >
            {v}개
          </button>
        ))}
      </div>
    </ModalCard>
  );
}
