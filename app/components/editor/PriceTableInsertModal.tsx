// =============================================
// File: app/components/editor/PriceTableInsertModal.tsx
// =============================================
'use client';

/**
 * 시세표 카드 삽입 모달
 * - 한 줄에 표시할 카드 개수(1~5) 선택 후 삽입
 * - (변경) onInsert가 cardsPerRow 뿐 아니라 items(추후 자동완성/DB 선택 결과)를 함께 전달할 수 있도록 payload 형태로 변경
 * - 툴바 드롭다운 자동 닫기 이벤트 발행
 * - 마우스/키보드(←/→, Enter) 모두 지원
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ModalCard } from '@/components/common/Modal';

export type InsertedPriceItem = {
  name: string;
  name_key: string;
  mode: string;      // 예: 'normal' | 'awakening' | 'transcend' 등 (프로젝트 규칙에 맞게)
  prices: string[];  // DB의 text[] 그대로 전달
};

export type PriceTableInsertPayload = {
  cardsPerRow: number;
  items: InsertedPriceItem[]; // 추후 자동완성/검색으로 채워질 예정 (지금은 빈 배열)
};

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: PriceTableInsertPayload) => void;
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
    onInsert({
      cardsPerRow: clamp(count),
      items: [], // ✅ 현재 단계: 카드 레이아웃만 삽입. 다음 단계에서 자동완성/선택으로 채움.
    });
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
          <button className="rd-btn secondary" onClick={onClose}>
            취소
          </button>
          <button className="rd-btn primary" onClick={handleInsert}>
            삽입
          </button>
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