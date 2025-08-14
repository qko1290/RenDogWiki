// =============================================
// File: app/components/editor/LinkInputModal.tsx
// =============================================

'use client';

/**
 * 외부 링크 삽입 모달
 * - 1개(large) 또는 2개(small, small) 입력
 * - 카드형 모달 + 드롭다운 자동 닫힘
 * - defaultValue는 모달이 열릴 때만 초기값으로 반영
 */

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

// http/https 만 허용하는 간단한 검사(브라우저의 type="url"과 병행)
const isHttpUrl = (s: string) => /^https?:\/\//i.test(s.trim());

export default function LinkInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = [],
}: LinkInputModalProps) {
  const [dualMode, setDualMode] = useState<boolean>(false);
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [errors, setErrors] = useState<{ first?: string; second?: string }>({});
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);

  // 🔧 "open"이 true로 바뀌는 순간에만 초기화 (defaultValue 의 참조 변화에 휘둘리지 않음)
  useEffect(() => {
    if (!open) return;
    const [u1 = '', u2 = ''] = defaultValue;
    setDualMode(!!u2);
    setUrls([u1, u2]);
    setErrors({});
    const t = setTimeout(() => firstRef.current?.focus(), 60);

    // 툴바 드롭다운 닫기
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    return () => clearTimeout(t);
    // ✅ 의존성은 open만!
  }, [open]);

  // URL 유효성
  const valid1 = urls[0].trim() ? isHttpUrl(urls[0]) : false;
  const valid2 = dualMode ? (urls[1].trim() ? isHttpUrl(urls[1]) : false) : true;

  const canSubmit =
    (dualMode && valid1 && valid2) ||
    (!dualMode && valid1);

  const handleSubmit = () => {
    if (!canSubmit) {
      setErrors({
        first: !valid1 ? 'http(s)로 시작하는 올바른 URL을 입력하세요.' : undefined,
        second: dualMode && !valid2 ? 'http(s)로 시작하는 올바른 URL을 입력하세요.' : undefined,
      });
      return;
    }
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

  // Escape로 닫기(모달 내에서만)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, [open, onClose]);

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
          aria-pressed={!dualMode}
          aria-label="링크 1개 모드"
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
          aria-pressed={dualMode}
          aria-label="링크 2개 모드"
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
          onChange={(e) => {
            const v = e.target.value;
            setUrls(prev => [v, prev[1]]);
            if (errors.first) setErrors(prev => ({ ...prev, first: undefined }));
          }}
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
          // ARIA: 값이 있고 유효하지 않으면 true, 아니면 undefined(속성 미지정)
          aria-invalid={urls[0] ? (!valid1 ? true : undefined) : undefined}
        />
        {errors.first && (
          <p className="rd-card-description" style={{ color: '#d32f2f', marginTop: -6 }}>
            {errors.first}
          </p>
        )}

        {dualMode && (
          <>
            <input
              ref={secondRef}
              className="rd-input"
              type="url"
              placeholder="두 번째 링크 (https://...)"
              value={urls[1]}
              onChange={(e) => {
                const v = e.target.value;
                setUrls(prev => [prev[0], v]);
                if (errors.second) setErrors(prev => ({ ...prev, second: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-invalid={urls[1] ? (!valid2 ? true : undefined) : undefined}
            />
            {errors.second && (
              <p className="rd-card-description" style={{ color: '#d32f2f', marginTop: -6 }}>
                {errors.second}
              </p>
            )}
          </>
        )}
      </div>
    </ModalCard>
  );
}
