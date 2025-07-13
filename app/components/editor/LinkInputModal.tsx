// File: app/components/editor/LinkInputModal.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function LinkInputModal({
  open,
  onClose,
  onSubmit,
  defaultValue = ''
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  defaultValue?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, boxShadow: '0 2px 20px #0002', minWidth: 340, padding: 28, display: 'flex', flexDirection: 'column', gap: 12
        }}>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>링크 삽입</div>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (url) { onSubmit(url); }
            }
          }}
          placeholder="https://example.com"
          style={{
            fontSize: 16, border: '1px solid #ccc', borderRadius: 6, padding: 8
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            style={{
              flex: 1, background: '#2775ec', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontWeight: 500, cursor: 'pointer'
            }}
            disabled={!url}
            onClick={() => url && onSubmit(url)}
          >삽입</button>
          <button
            style={{
              flex: 1, background: '#eee', border: 'none', borderRadius: 6, padding: '8px 0', fontWeight: 400, cursor: 'pointer'
            }}
            onClick={onClose}
          >취소</button>
        </div>
      </div>
    </div>
  );
}
