// components/editor/WikiDbEmbedIdModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { WikiEmbedKind } from '../helpers/insertWikiDbEmbed';

type Props = {
  open: boolean;
  kind: WikiEmbedKind;
  onClose: () => void;
  onSubmit: (id: number) => void;
};

export default function WikiDbEmbedIdModal({ open, kind, onClose, onSubmit }: Props) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(() => {
    if (kind === 'quest') return '퀘스트';
    if (kind === 'npc') return 'NPC';
    return 'QNA';
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('rd-modal-open');
    return () => document.body.classList.remove('rd-modal-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRaw('');
    setError(null);
  }, [open, kind]);

  if (!open) return null;

  const submit = () => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      setError('양의 정수 ID만 입력해줘.');
      return;
    }
    setError(null);
    onSubmit(n);
  };

  return (
    <div
      onMouseDown={(e) => {
        // backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '100%',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e5e7eb',
          boxShadow: '0 18px 60px rgba(0,0,0,.18)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef0f2' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{label} ID 입력</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
            DB에 있는 <b>고유 id</b>만 넣으면 돼 (지금은 id만 저장)
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <input
            autoFocus
            inputMode="numeric"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="예: 123"
            style={{
              width: '100%',
              height: 42,
              borderRadius: 10,
              border: '1px solid #dbe3ef',
              padding: '0 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />

          {error && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              취소
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #2a90ff',
                background: '#2a90ff',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              삽입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
