// =============================================
// File: app/components/editor/LinkInputModal.tsx
// =============================================

'use client';

import React, { useState, useRef, useEffect } from 'react';

type LinkInputModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (items: { url: string, size: 'large' | 'small' }[]) => void;
  defaultValue?: string[];
};

/**
 * 링크 삽입용 모달
 * - 1개 또는 2개(dualMode) URL 입력 지원
 * - 사이즈 large/small 선택(2개일 때 small)
 */
export default function LinkInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = [],
}: LinkInputModalProps) {
  const [dualMode, setDualMode] = useState(false);
  const [urls, setUrls] = useState<string[]>([defaultValue[0] || '', defaultValue[1] || '']);
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // 모달 열릴 때 기본값 및 모드 초기화
  useEffect(() => {
    if (open) {
      setUrls([defaultValue[0] || '', defaultValue[1] || '']);
      setDualMode(false);
      setTimeout(() => inputRefs[0].current?.focus(), 50);
    }
    // eslint-disable-next-line
  }, [open]);

  if (!open) return null;

  // 삽입 버튼/엔터 동작
  const handleInsert = () => {
    if (dualMode) {
      if (urls[0] && urls[1]) {
        onSubmit([
          { url: urls[0], size: 'small' },
          { url: urls[1], size: 'small' },
        ]);
      }
    } else {
      if (urls[0]) {
        onSubmit([{ url: urls[0], size: 'large' }]);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0, top: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.15)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 20px #0002',
          minWidth: 370,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* 제목 및 1개/2개 스위치 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 18, flex: 1 }}>
            링크 삽입
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: dualMode ? 400 : 600,
                color: dualMode ? '#bbb' : '#333',
                cursor: 'pointer',
              }}
              onClick={() => setDualMode(false)}
            >1개</span>
            {/* 토글 스위치 */}
            <label style={{
              display: 'inline-block', width: 38, height: 22, position: 'relative', margin: '0 3px', cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={dualMode}
                onChange={e => setDualMode(e.target.checked)}
                style={{ display: 'none' }}
              />
              <span style={{
                position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                background: dualMode ? '#2dc97e' : '#ddd',
                borderRadius: 12, transition: 'background .18s'
              }} />
              <span style={{
                position: 'absolute', top: 3, left: dualMode ? 19 : 3, width: 16, height: 16,
                background: '#fff', borderRadius: '50%', transition: 'left .18s', boxShadow: '0 1px 4px #0001'
              }} />
            </label>
            <span
              style={{
                fontSize: 14,
                fontWeight: dualMode ? 600 : 400,
                color: dualMode ? '#333' : '#bbb',
                cursor: 'pointer',
              }}
              onClick={() => setDualMode(true)}
            >2개</span>
          </div>
        </div>
        {/* URL 입력 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={inputRefs[0]}
            type="url"
            value={urls[0]}
            onChange={e => setUrls([e.target.value, urls[1]])}
            placeholder="https://example.com"
            style={{
              fontSize: 16,
              border: '1px solid #ccc',
              borderRadius: 6,
              padding: 8,
              marginBottom: dualMode ? 6 : 0,
            }}
            onKeyDown={e => {
              if (!dualMode && e.key === 'Enter') {
                e.preventDefault();
                if (urls[0]) onSubmit([{ url: urls[0], size: 'large' }]);
              }
              if (dualMode && e.key === 'Enter') {
                if (inputRefs[1].current && e.currentTarget === inputRefs[0].current) {
                  e.preventDefault();
                  inputRefs[1].current.focus();
                } else {
                  e.preventDefault();
                  handleInsert();
                }
              }
            }}
            autoFocus
          />
          {dualMode && (
            <input
              ref={inputRefs[1]}
              type="url"
              value={urls[1]}
              onChange={e => setUrls([urls[0], e.target.value])}
              placeholder="두 번째 링크 (https://...)"
              style={{
                fontSize: 16,
                border: '1px solid #ccc',
                borderRadius: 6,
                padding: 8,
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInsert();
                }
              }}
            />
          )}
        </div>
        {/* 삽입/취소 버튼 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            style={{
              flex: 1,
              background: '#2dc97e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 0',
              fontWeight: 600,
              fontSize: 17,
              cursor: 'pointer',
            }}
            disabled={
              (dualMode && (!urls[0] || !urls[1]))
              || (!dualMode && !urls[0])
            }
            onClick={handleInsert}
          >
            삽입
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            style={{
              flex: 1,
              background: '#eee',
              border: 'none',
              borderRadius: 6,
              padding: '8px 0',
              fontWeight: 400,
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
