// =============================================
// File: app/components/editor/ImageUrlInputModal.tsx
// =============================================

/**
 * 이미지 URL 입력 및 삽입용 모달 컴포넌트
 * - 사용자가 외부 이미지 URL을 입력하면 유효성 검사 후 삽입
 * - 재사용 가능한 공통 Modal 컴포넌트 활용
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Modal from '@/components/common/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  defaultValue?: string;
};

export default function ImageUrlInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = ''
}: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 모달 오픈 시 초기화 및 포커스
  useEffect(() => {
    if (open) {
      setUrl(defaultValue);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  // 이미지 URL 검증 후 삽입
  const handleSubmit = () => {
    if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.trim())) {
      setError('이미지 파일 URL만 입력 가능합니다.');
      return;
    }
    setError('');
    onSubmit(url.trim());
    setUrl('');
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="이미지 링크로 삽입">
      <div>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === "Enter") { handleSubmit(); } }}
          placeholder="https://example.com/image.png"
          style={{
            fontSize: 16,
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 8,
            width: '100%'
          }}
        />
        {error && (
          <div style={{ color: "#d00", fontSize: 14, marginTop: 7 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            style={{
              flex: 1,
              background: '#2775ec',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 0',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            disabled={!url}
            onClick={handleSubmit}
          >
            삽입
          </button>
          <button
            style={{
              flex: 1,
              background: '#eee',
              border: 'none',
              borderRadius: 6,
              padding: '8px 0',
              fontWeight: 400,
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            취소
          </button>
        </div>
      </div>
    </Modal>
  );
}
