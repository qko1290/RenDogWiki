// =============================================
// File: app/components/editor/PriceTableInsertModal.tsx
// =============================================
import React, { useState } from 'react';
import Modal from '@/components/common/Modal';

/**
 * 시세표 카드 삽입 모달
 * - 한 줄에 카드 몇 개 삽입할지 선택
 */
export default function PriceTableInsertModal({
  open,
  onClose,
  onInsert
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (cardsPerRow: number) => void;
}) {
  const [count, setCount] = useState(3);

  return (
    <Modal open={open} onClose={onClose} title="시세표 카드 삽입">
      <div style={{ fontSize: 16, margin: 10 }}>한 줄에 몇 개의 카드?</div>
      <select
        value={count}
        onChange={e => setCount(Number(e.target.value))}
        style={{ fontSize: 18, padding: 8 }}
      >
        {[1, 2, 3, 4, 5].map(v => (
          <option key={v} value={v}>
            {v}개
          </option>
        ))}
      </select>
      <button
        style={{
          marginTop: 24,
          fontSize: 17,
          padding: '8px 22px',
          borderRadius: 7,
          background: '#3774e8',
          color: '#fff',
          fontWeight: 700
        }}
        onClick={() => onInsert(count)}
      >
        삽입
      </button>
    </Modal>
  );
}
