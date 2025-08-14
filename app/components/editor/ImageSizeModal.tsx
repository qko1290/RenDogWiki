// =============================================
// File: app/components/editor/ImageSizeModal.tsx
// =============================================

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ModalCard } from '@/components/common/Modal';

type Props = {
  open: boolean;
  width?: number;
  height?: number;
  onSave: (w: number, h: number) => void;
  onClose: () => void;
};

/** 내부 유틸: 숫자 클램프 */
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n || 0));

/** 이미지 크기 조정 모달 (카드형, 중앙 정렬) */
export default function ImageSizeModal({ open, width, height, onSave, onClose }: Props) {
  const [w, setW] = useState<number>(width || 256);
  const [h, setH] = useState<number>(height || 256);
  const [keepRatio, setKeepRatio] = useState(false);
  const [ratio, setRatio] = useState(1); // w/h

  /** 모달 열릴 때마다 현재 props로 상태 재동기화 */
  useEffect(() => {
    if (!open) return;
    const initW = width && width > 0 ? width : 256;
    const initH = height && height > 0 ? height : 256;
    setW(initW);
    setH(initH);
    setRatio(initH ? initW / initH : 1);
    // 드롭다운 닫기(툴바와의 상호작용 유지)
    window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
  }, [open, width, height]);

  /** 비율 고정 켜질 때 현재 w/h로 ratio 재계산(0 분모 방지) */
  useEffect(() => {
    if (!keepRatio) return;
    setRatio(prev => {
      const safe = h > 0 ? w / h : (prev || 1);
      return Number.isFinite(safe) && safe > 0 ? safe : 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepRatio]);

  /** w 변경 시 h를 비율에 맞춰 자동 변경 */
  useEffect(() => {
    if (!keepRatio) return;
    const nextH = Math.max(1, Math.round(w / (ratio || 1)));
    if (nextH !== h) setH(nextH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  /** h 변경 시 w를 비율에 맞춰 자동 변경 */
  useEffect(() => {
    if (!keepRatio) return;
    const nextW = Math.max(1, Math.round(h * (ratio || 1)));
    if (nextW !== w) setW(nextW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  const handleSave = useCallback(() => {
    const cw = clamp(w, 1, 4096);
    const ch = clamp(h, 1, 4096);
    onSave(cw, ch);
  }, [h, w, onSave]);

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
          aria-checked={keepRatio}
          aria-label="가로 세로 비율 고정"
        />
        <label htmlFor="keepRatio" style={{ fontSize: 14, color:'#374151' }}>
          비율 고정 (현재 비율 {(Number.isFinite(ratio) && ratio > 0 ? ratio : 1).toFixed(2)})
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
            step={1}
            value={w}
            onChange={(e)=> setW(clamp(Number(e.target.value || 0), 0, 4096))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            aria-label="가로 크기"
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
            step={1}
            value={h}
            onChange={(e)=> setH(clamp(Number(e.target.value || 0), 0, 4096))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            aria-label="세로 크기"
            style={{ width: 120 }}
          />
        </div>
      </div>
    </ModalCard>
  );
}
