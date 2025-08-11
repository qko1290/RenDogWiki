// =============================================
// File: app/components/editor/ImageSizeModal.tsx
// =============================================

'use client';

import React, { useEffect, useState } from 'react';
import { ModalCard } from '@/components/common/Modal';

type Props = {
  open: boolean;
  width?: number;
  height?: number;
  onSave: (w: number, h: number) => void;
  onClose: () => void;
};

/** 이미지 크기 조정 모달 (카드형, 중앙 정렬) */
export default function ImageSizeModal({ open, width, height, onSave, onClose }: Props) {
  const [w, setW] = useState(width || 256);
  const [h, setH] = useState(height || 256);
  const [keepRatio, setKeepRatio] = useState(false);
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    if (width && height) setRatio(width / height);
  }, [width, height]);

  // 열릴 때 드롭다운 닫기
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [open]);

  useEffect(() => {
    if (keepRatio) setH(Math.max(1, Math.round(w / ratio)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, keepRatio]);

  useEffect(() => {
    if (keepRatio) setW(Math.max(1, Math.round(h * ratio)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, keepRatio]);

  const handleSave = () => onSave(Math.max(1, w), Math.max(1, h));

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="이미지 크기 설정"
      width={420}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>취소</button>
          <button className="rd-btn primary" onClick={handleSave}>저장</button>
        </>
      }
    >
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id="keepRatio"
          type="checkbox"
          checked={keepRatio}
          onChange={(e)=>setKeepRatio(e.target.checked)}
        />
        <label htmlFor="keepRatio" style={{ fontSize: 14, color:'#374151' }}>
          비율 고정 (현재 비율 {ratio.toFixed(2)})
        </label>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize: 13, marginBottom: 4, color:'#6b7280' }}>가로(px)</div>
          <input
            className="rd-input"
            type="number"
            min={1}
            max={4096}
            value={w}
            onChange={(e)=>setW(Number(e.target.value || 0))}
            style={{ width: 120 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, marginBottom: 4, color:'#6b7280' }}>세로(px)</div>
          <input
            className="rd-input"
            type="number"
            min={1}
            max={4096}
            value={h}
            onChange={(e)=>setH(Number(e.target.value || 0))}
            style={{ width: 120 }}
          />
        </div>
      </div>
    </ModalCard>
  );
}
