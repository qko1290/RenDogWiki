// =============================================
// File: app/components/editor/PriceTableInsertModal.tsx
// =============================================
'use client';

import React, { useEffect, useState } from 'react';
import { ModalCard } from '@/components/common/Modal';

/** 시세표 카드 삽입 모달 – 한 줄 카드 개수 선택 */
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

  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [open]);

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="시세표 카드 삽입"
      width={420}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>취소</button>
          <button className="rd-btn primary" onClick={() => onInsert(count)}>삽입</button>
        </>
      }
    >
      <div style={{ fontSize: 15, color:'#475569', marginBottom: 10 }}>한 줄에 표시할 카드 개수를 선택하세요.</div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        {[1,2,3,4,5].map(v=>(
          <button
            key={v}
            type="button"
            className="rd-btn"
            onClick={()=>setCount(v)}
            style={{
              minWidth:56, height:36, borderRadius:10,
              background: count===v ? '#2563eb' : '#f3f4f6',
              color: count===v ? '#fff' : '#475569',
              fontWeight:800
            }}
          >
            {v}개
          </button>
        ))}
      </div>
    </ModalCard>
  );
}
