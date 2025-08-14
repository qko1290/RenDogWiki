// =============================================
// File: app/components/editor/ImageUrlInputModal.tsx
// =============================================

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ModalCard } from '@/components/common/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  defaultValue?: string;
};

/** 이미지 URL로 삽입 모달 (카드형) */
export default function ImageUrlInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = '',
}: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const descId = 'image-url-error';

  /** http/https URL만 허용하는 검증 */
  const isValidUrl = useCallback((s: string) => {
    try {
      const u = new URL(s.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setUrl(defaultValue);
    setError('');
    // 포커스 + 전체 선택
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }, 60);
    // 툴바 드롭다운 닫기(기존 연동 유지)
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    return () => clearTimeout(t);
  }, [open, defaultValue]);

  // Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const valid = isValidUrl(url);

  const handleSubmit = useCallback(() => {
    if (!valid) {
      setError('http(s)로 시작하는 올바른 URL을 입력하세요.');
      return;
    }
    onSubmit(url.trim());
    onClose();
  }, [onClose, onSubmit, url, valid]);

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="이미지 링크로 삽입"
      width={520}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>취소</button>
          <button className="rd-btn primary" onClick={handleSubmit} disabled={!valid}>삽입</button>
        </>
      }
    >
      <input
        ref={inputRef}
        className="rd-input"
        type="url"
        placeholder="https://example.com/image.png"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
        }}
        aria-invalid={!valid}
        aria-describedby={error ? descId : undefined}
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        pattern="https?://.*"
      />
      {error && (
        <p id={descId} className="rd-card-description" style={{ color: '#d32f2f' }}>
          {error}
        </p>
      )}
    </ModalCard>
  );
}
