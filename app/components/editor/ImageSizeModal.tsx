import React, { useState, useEffect } from 'react';

type Props = {
  open: boolean;
  width?: number;
  height?: number;
  onSave: (w: number, h: number) => void;
  onClose: () => void;
};

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const innerStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 6px 32px #0003',
  padding: '32px 32px 20px 32px',
  minWidth: 320,
  maxWidth: 360,
  textAlign: 'center',
};

export default function ImageSizeModal({ open, width, height, onSave, onClose }: Props) {
  const [w, setW] = useState(width || 256);
  const [h, setH] = useState(height || 256);
  const [keepRatio, setKeepRatio] = useState(false);
  const [ratio, setRatio] = useState(1);

  // 최초 비율 저장
  useEffect(() => {
    if (width && height) setRatio(width / height);
  }, [width, height]);

  // width 변경 시, 비율 고정이면 height도 자동 변경
  useEffect(() => {
    if (keepRatio) setH(Math.round(w / ratio));
    // eslint-disable-next-line
  }, [w, keepRatio]);

  // height 변경 시, 비율 고정이면 width도 자동 변경
  useEffect(() => {
    if (keepRatio) setW(Math.round(h * ratio));
    // eslint-disable-next-line
  }, [h, keepRatio]);

  if (!open) return null;

  return (
    <div style={modalStyle} onClick={onClose}>
        <div style={innerStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 18 }}>이미지 크기 설정</h3>
        {/* 비율 고정 체크박스 */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input
            type="checkbox"
            id="keepRatio"
            checked={keepRatio}
            onChange={e => setKeepRatio(e.target.checked)}
            />
            <label htmlFor="keepRatio" style={{ fontSize: 15, color: "#333" }}>
            비율 고정 (현재 비율 {ratio.toFixed(2)})
            </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            <div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>가로(px)</div>
            <input
                type="number"
                value={w}
                min={16}
                max={1024}
                style={{ width: 80, fontSize: 16, padding: 6 }}
                onChange={e => {
                const newW = Number(e.target.value);
                setW(newW);
                if (keepRatio) setH(Math.round(newW / ratio));
                }}
            />
            </div>
            <div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>세로(px)</div>
            <input
                type="number"
                value={h}
                min={16}
                max={1024}
                style={{ width: 80, fontSize: 16, padding: 6 }}
                onChange={e => {
                const newH = Number(e.target.value);
                setH(newH);
                if (keepRatio) setW(Math.round(newH * ratio));
                }}
            />
            </div>
        </div>
        <button
            onClick={() => onSave(w, h)}
            style={{
            background: '#2a90ff', color: '#fff', border: 0, borderRadius: 8, fontSize: 16, padding: '8px 30px'
            }}
        >저장</button>
        <button
            onClick={onClose}
            style={{
            background: 'none', border: 0, marginLeft: 18, color: '#888', fontSize: 16
            }}
        >취소</button>
        </div>
    </div>
    );
}
