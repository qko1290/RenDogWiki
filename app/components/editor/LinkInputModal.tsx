'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ModalCard } from '@/components/common/Modal';

type LinkItem = { url: string; size: 'large' | 'small' };

type LinkInputModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (items: LinkItem[]) => void;
  /** 모달이 열릴 때만 초기값으로 사용됩니다. (열린 뒤에는 변경 무시) */
  defaultValue?: string[];
};

/**
 * 외부 링크 삽입 모달
 * - 1개(large) 또는 2개(small, small) 입력
 * - 카드형 모달 + 드롭다운 자동 닫힘
 */
export default function LinkInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = [],
}: LinkInputModalProps) {
  const [dualMode, setDualMode] = useState<boolean>(false);
  const [urls, setUrls] = useState<string[]>(['', '']);
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);

  // 🔧 "open"이 true로 바뀌는 순간에만 초기화 (defaultValue 의 참조 변화에 휘둘리지 않음)
  useEffect(() => {
    if (!open) return;
    const [u1 = '', u2 = ''] = defaultValue;
    setDualMode(!!u2);
    setUrls([u1, u2]);
    const t = setTimeout(() => firstRef.current?.focus(), 60);
    // 툴바 드롭다운 닫기
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    return () => clearTimeout(t);
    // ✅ 의존성은 open만!
  }, [open]);

  const canSubmit =
    (dualMode && urls[0].trim() && urls[1].trim()) ||
    (!dualMode && urls[0].trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (dualMode) {
      onSubmit([
        { url: urls[0].trim(), size: 'small' },
        { url: urls[1].trim(), size: 'small' },
      ]);
    } else {
      onSubmit([{ url: urls[0].trim(), size: 'large' }]);
    }
    onClose();
  };

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="외부 링크 삽입"
      width={560}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>취소</button>
          <button className="rd-btn primary" onClick={handleSubmit} disabled={!canSubmit}>삽입</button>
        </>
      }
    >
      {/* 1개 / 2개 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}>
        <button
          type="button"
          onClick={() => setDualMode(false)}
          className="rd-btn"
          style={{
            height: 36, minWidth: 72, borderRadius: 999,
            background: !dualMode ? '#2563eb' : '#f3f4f6',
            color: !dualMode ? '#fff' : '#475569',
            fontWeight: 800,
          }}
        >1개</button>
        <button
          type="button"
          onClick={() => setDualMode(true)}
          className="rd-btn"
          style={{
            height: 36, minWidth: 72, borderRadius: 999,
            background: dualMode ? '#2563eb' : '#f3f4f6',
            color: dualMode ? '#fff' : '#475569',
            fontWeight: 800,
          }}
        >2개</button>
        <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 13 }}>
          1개는 큰 카드, 2개는 두 칸 카드로 삽입됩니다.
        </div>
      </div>

      {/* URL 입력 */}
      <div style={{ display: 'grid', gap: 10 }}>
        <input
          ref={firstRef}
          className="rd-input"
          type="url"
          placeholder="https://example.com"
          value={urls[0]}
          onChange={(e) => setUrls([e.target.value, urls[1]])}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (dualMode) {
                e.preventDefault();
                secondRef.current?.focus();
              } else {
                e.preventDefault();
                handleSubmit();
              }
            }
          }}
        />
        {dualMode && (
          <input
            ref={secondRef}
            className="rd-input"
            type="url"
            placeholder="두 번째 링크 (https://...)"
            value={urls[1]}
            onChange={(e) => setUrls([urls[0], e.target.value])}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        )}
      </div>
    </ModalCard>
  );
}
