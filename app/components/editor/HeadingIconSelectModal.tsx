// app/components/editor/HeadingIconSelectModal.tsx
'use client';

import React, { useState } from 'react';
import ImageSelectModal from '@/components/image/ImageSelectModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (icon: string) => void;
};

export default function HeadingIconSelectModal({ open, onClose, onSubmit }: Props) {
  const [emoji, setEmoji] = useState('');
  const [imgModalOpen, setImgModalOpen] = useState(false);

  // 완료 버튼 클릭시
  const handleSubmit = () => {
    const icon = emoji.trim();
    if (icon) {
      onSubmit(icon);
      onClose();
    }
  };

  return open ? (
    <div
      style={{
        position: 'fixed',
        left: 0, top: 0, right: 0, bottom: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, padding: 30, minWidth: 320, minHeight: 120,
          boxShadow: '0 2px 16px 0 #0002', position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 18 }}>제목 아이콘 선택</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            style={{ fontSize: 28, width: 48, textAlign: 'center' }}
            placeholder="🦊"
            maxLength={2}
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
          />
          <span style={{ fontSize: 14, color: '#aaa' }}>또는</span>
          <button
            style={{
              padding: '4px 18px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#f8f8f8',
              cursor: 'pointer',
              fontSize: 17,
            }}
            onClick={() => setImgModalOpen(true)}
          >
            이미지 선택
          </button>
        </div>
        <div style={{ marginTop: 22, textAlign: 'right' }}>
          <button
            style={{
              background: '#222',
              color: '#fff',
              padding: '7px 22px',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              marginRight: 10,
            }}
            onClick={onClose}
          >
            취소
          </button>
          <button
            style={{
              background: '#3ed47e',
              color: '#fff',
              padding: '7px 22px',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
            }}
            onClick={handleSubmit}
            disabled={!emoji.trim()}
          >
            적용
          </button>
        </div>

        {/* 이미지 선택 모달 */}
        <ImageSelectModal
          open={imgModalOpen}
          onClose={() => setImgModalOpen(false)}
          onSelectImage={url => {
            onSubmit(url); // 이미지 URL을 아이콘으로 사용
            setImgModalOpen(false);
            onClose();
          }}
        />
      </div>
    </div>
  ) : null;
}
