// =============================================
// File: app/components/editor/ImageUrlInputModal.tsx
// =============================================

'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!open) return;
    setUrl(defaultValue);
    setError('');
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    return () => clearTimeout(t);
  }, [open, defaultValue]);

  const valid = /^https?:\/\//i.test(url.trim()); // 확장자 제한 없이 http(s)만 확인

  const handleSubmit = () => {
    if (!valid) { setError('http(s)로 시작하는 올바른 URL을 입력하세요.'); return; }
    onSubmit(url.trim());
    onClose();
  };

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
        onChange={(e)=>{ setUrl(e.target.value); setError(''); }}
        onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); handleSubmit(); } }}
      />
      {error && <p className="rd-card-description" style={{ color:'#d32f2f' }}>{error}</p>}
    </ModalCard>
  );
}
