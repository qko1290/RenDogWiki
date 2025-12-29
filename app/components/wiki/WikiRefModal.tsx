'use client';

import React, { useEffect, useMemo, useState } from 'react';
import NpcDetailModal, { type Npc } from '@/components/wiki/NpcDetailModal';
import type { WikiRefKind } from '@/components/editor/render/types';

type Faq = {
  id: number;
  title: string;
  content: string;
  tags?: string[];
};

function FaqDetailModal({ faq, onClose }: { faq: Faq; onClose: () => void }) {
  useEffect(() => {
    document.body.classList.add('rd-modal-open');
    return () => document.body.classList.remove('rd-modal-open');
  }, []);

  return (
    <div className="faq-upsert-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="faq-upsert-modal" onClick={(e) => e.stopPropagation()}>
        <header className="upsert-header">
          <div className="upsert-title">
            <span className="upsert-chip">QnA</span>
            <h3>{faq.title}</h3>
          </div>
          <button className="upsert-close" onClick={onClose} aria-label="close">
            <svg className="x-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
              <path d="M6 6L18 18M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="upsert-body">
          {!!faq.tags?.length && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {faq.tags.map((t, i) => (
                <span
                  key={i}
                  className="upsert-chip"
                  style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 10 }}>
            <label>내용</label>
            <div className="textarea" style={{ whiteSpace: 'pre-wrap', height: 'auto', minHeight: 160 }}>
              {faq.content}
            </div>
          </div>
        </div>

        <footer className="upsert-footer">
          <button className="upsert-save" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>

      <style jsx>{`
        .faq-upsert-backdrop {
          position: fixed;
          inset: 0;
          z-index: 21000;
          background: rgba(15, 23, 42, 0.45);
          display: grid;
          place-items: center;
          padding: 16px;
          backdrop-filter: blur(2px);
        }
        .faq-upsert-modal {
          width: min(720px, 100%);
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 22px 80px rgba(0, 0, 0, 0.22);
          overflow: hidden;
        }
        .upsert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(180deg, #ffffff, #fafbfc);
        }
        .upsert-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .upsert-title h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }
        .upsert-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #065f46;
          background: #ecfdf5;
          border: 1px solid #b7f0d0;
        }
        .upsert-close {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 0;
          border-radius: 0;
          color: #ef4444;
          cursor: pointer;
        }
        .upsert-close .x-ic {
          width: 18px;
          height: 18px;
        }
        .upsert-body {
          padding: 16px;
          display: grid;
          gap: 12px;
        }
        .field label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .textarea {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 15px;
          color: #0f172a;
          outline: none;
          background: #fff;
        }
        .upsert-footer {
          display: flex;
          justify-content: flex-end;
          padding: 12px 16px;
          border-top: 1px solid #f1f5f9;
          background: #fff;
        }
        .upsert-save {
          height: 40px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid #93c5fd;
          color: #fff;
          font-weight: 800;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default function WikiRefModal({
  open,
  kind,
  id,
  onClose,
}: {
  open: boolean;
  kind: WikiRefKind;
  id: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [npc, setNpc] = useState<Npc | null>(null);
  const [faq, setFaq] = useState<Faq | null>(null);
  const title = useMemo(() => `${kind.toUpperCase()} #${id}`, [kind, id]);

  useEffect(() => {
    if (!open) return;
    if (!Number.isFinite(id) || id <= 0) return;

    let alive = true;
    setLoading(true);
    setNpc(null);
    setFaq(null);

    (async () => {
      try {
        if (kind === 'npc' || kind === 'quest') {
          const r = await fetch(`/api/npc/${id}`, { cache: 'no-store' });
          if (!r.ok) throw new Error('npc fetch failed');
          const data = (await r.json()) as any;
          if (!alive) return;
          setNpc(data as Npc);
        } else if (kind === 'qna') {
          const r = await fetch(`/api/faq/${id}`, { cache: 'no-store' });
          if (!r.ok) throw new Error('faq fetch failed');
          const data = (await r.json()) as any;
          if (!alive) return;
          setFaq({
            id: data.id,
            title: data.title,
            content: data.content,
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
        }
      } catch {
        if (!alive) return;
        alert(`${title} 불러오기에 실패했습니다.`);
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, kind, id, onClose, title]);

  if (!open) return null;

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 21000,
          background: 'rgba(15,23,42,0.45)',
          display: 'grid',
          placeItems: 'center',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: '14px 16px',
            fontWeight: 800,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          불러오는 중…
        </div>
      </div>
    );
  }

  if ((kind === 'npc' || kind === 'quest') && npc) {
    return <NpcDetailModal npc={npc} onClose={onClose} mode={kind === 'quest' ? 'quest' : 'npc'} />;
  }
  if (kind === 'qna' && faq) {
    return <FaqDetailModal faq={faq} onClose={onClose} />;
  }

  return null;
}
