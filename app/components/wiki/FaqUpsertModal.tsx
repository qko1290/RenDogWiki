// File: app/components/wiki/FaqUpsertModal.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: { id?: number; title?: string; content?: string; tags?: string[] | string };
  onClose: () => void;
  onSaved: () => void; // 저장 성공 후 상위에서 리스트 refresh 등
};

export default function FaqUpsertModal({ open, mode, initial, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tags, setTags] = useState<string>(
    Array.isArray(initial?.tags) ? (initial?.tags as string[]).join(',') : (initial?.tags as string) ?? ''
  );
  const [saving, setSaving] = useState(false);

  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setTags(Array.isArray(initial?.tags) ? (initial?.tags as string[]).join(',') : (initial?.tags as string) ?? '');
  }, [open, initial?.title, initial?.content, initial?.tags]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const r = await fetch('/api/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
        });
        if (!r.ok) throw 0;
      } else {
        const id = initial?.id!;
        const r = await fetch(`/api/faq/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
        });
        if (!r.ok) throw 0;
      }
      onSaved();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl(or Cmd)+Enter 로 빠른 저장
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (!saving) handleSave();
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, title, content, tags]);

  if (!open) return null;

  return (
    <div
      className="faq-upsert-backdrop"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
      onTouchStart={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onTouchEnd={(e) => {
        if (downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div className="faq-upsert-modal" onClick={(e) => e.stopPropagation()}>
        <header className="upsert-header">
          <div className="upsert-title">
            <span className="upsert-chip">{mode === 'create' ? '새 질문' : '질문 수정'}</span>
            <h3>{mode === 'create' ? '질문 추가' : '질문 수정'}</h3>
          </div>
          <button className="upsert-close" onClick={onClose} aria-label="close">✕</button>
        </header>

        <div className="upsert-body">
          <div className="field">
            <label>제목</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="질문을 입력하세요"
            />
          </div>

          <div className="field">
            <label>내용</label>
            <textarea
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="답변 내용을 입력하세요"
            />
          </div>

          <div className="field">
            <label>태그(쉼표로 구분)</label>
            <input
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="예: 완전체정수, 2차전직"
            />
          </div>
        </div>

        <footer className="upsert-footer">
          {/* 🔵 세련된 단일 저장 버튼 */}
          <button className="upsert-save" onClick={handleSave} disabled={saving} aria-label="save">
            <svg className="save-ic" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>

      <style jsx>{`
        .faq-upsert-backdrop{
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15, 23, 42, 0.45);
          display: grid; place-items: center; padding: 16px;
          backdrop-filter: blur(2px);
        }
        .faq-upsert-modal{
          width: min(720px, 100%); background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 22px 80px rgba(0,0,0,0.22);
          overflow: hidden;
        }
        .upsert-header{
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(180deg,#ffffff, #fafbfc);
        }
        .upsert-title{ display: flex; align-items: center; gap: 10px; }
        .upsert-title h3{ margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
        .upsert-chip{
          display: inline-flex; align-items:center; justify-content:center;
          height: 26px; padding: 0 10px; border-radius: 999px;
          font-size: 12px; font-weight: 700; color: #065f46; background: #ecfdf5; border: 1px solid #b7f0d0;
        }
        .upsert-close{
          width: 34px; height: 34px; border-radius: 10px;
          border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
        }
        .upsert-body{ padding: 16px; display: grid; gap: 12px; }
        .field label{
          display:block; font-size: 12px; color:#6b7280; margin-bottom: 6px; font-weight:600;
        }
        .input, .textarea{
          width: 100%;
          border: 1px solid #e5e7eb; border-radius: 12px;
          padding: 10px 12px; font-size: 15px; color: #0f172a;
          outline: none; background: #fff;
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .input:focus, .textarea:focus{
          border-color: #93c5fd;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
        }
        .textarea{ height: 160px; resize: vertical; }

        .upsert-footer{
          display:flex; justify-content:flex-end;
          padding: 12px 16px; border-top: 1px solid #f1f5f9; background:#fff;
        }

        /* 🔵 저장 버튼 – 블루 그라디언트 + 은은한 글로우 */
        .upsert-save{
          position: relative;
          display: inline-flex; align-items: center; gap: 8px;
          height: 40px; padding: 0 16px;
          border-radius: 12px;
          border: 1px solid #93c5fd;
          color: #fff; font-weight: 800; letter-spacing: .2px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
          box-shadow:
            0 10px 22px rgba(37, 99, 235, 0.25),
            inset 0 1px 0 rgba(255,255,255,.28);
          transition: transform .12s ease, box-shadow .2s ease, filter .2s ease;
          cursor: pointer;
        }
        .upsert-save:hover{
          transform: translateY(-1px);
          box-shadow:
            0 14px 28px rgba(37, 99, 235, 0.32),
            inset 0 1px 0 rgba(255,255,255,.35);
          filter: saturate(1.05);
        }
        .upsert-save:active{
          transform: translateY(0);
          box-shadow:
            0 8px 18px rgba(37, 99, 235, 0.22),
            inset 0 1px 0 rgba(255,255,255,.25);
        }
        .upsert-save:disabled{
          cursor: default;
          background: linear-gradient(135deg, #cbd5e1, #94a3b8);
          border-color: #cbd5e1;
          box-shadow: none;
        }
        .save-ic{ width: 18px; height: 18px; }
      `}</style>
    </div>
  );
}
