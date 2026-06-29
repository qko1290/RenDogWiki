'use client';

import React from 'react';

export type WeaponVideoModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

export default function WeaponVideoModal({
  open,
  url,
  onClose,
}: WeaponVideoModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 90vw)',
          maxHeight: '80vh',
          background: '#020617',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(0,0,0,.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #111827',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#e5e7eb',
            fontSize: 14,
          }}
        >
          <span>공격 영상</span>

          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '3px 10px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 12,
              cursor: 'pointer',
            }}
            aria-label="공격 영상 닫기"
          >
            닫기
          </button>
        </div>

        <video
          src={url}
          controls
          autoPlay
          playsInline
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 'calc(80vh - 40px)',
            background: '#000',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
}