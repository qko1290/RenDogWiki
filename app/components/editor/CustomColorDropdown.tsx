// =============================================
// File: app/components/editor/CustomColorDropdown.tsx
// =============================================
'use client';

import React, { useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

type Props = {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  recentColors: string[];
  setRecentColors: React.Dispatch<React.SetStateAction<string[]>>;
  kind?: 'text' | 'background';
};

/** HSL -> HEX */
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60)       { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120){ r = x; g = c; b = 0; }
  else if (120 <= h && h < 180){ r = 0; g = c; b = x; }
  else if (180 <= h && h < 240){ r = 0; g = x; b = c; }
  else if (240 <= h && h < 300){ r = x; g = 0; b = c; }
  else                         { r = c; g = 0; b = x; }
  const to255 = (n: number) => Math.round((n + m) * 255);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(to255(r))}${toHex(to255(g))}${toHex(to255(b))}`;
}

/** 12열 × 7행 팔레트 */
function buildColorGrid(): string[][] {
  const hues = [0, 20, 35, 45, 60, 90, 120, 160, 190, 220, 260, 300];
  const lightness = [92, 84, 74, 64, 54, 44, 34];
  const s = 70;
  return lightness.map(L => hues.map(H => hslToHex(H, s, L)));
}

const GRAYS = ['#ffffff', '#f8fafc', '#f1f5f9', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#111827', '#000000'];

/** 레이아웃 상수 */
const CELL = 14;   // 정사각 타일 한 변
const GAP  = 4;
const COLS = 12;
const PAD  = 10;
const GRID_W = COLS * CELL + (COLS - 1) * GAP; // 212
const CONTAINER_W = GRID_W + PAD * 2;          // 232

/** 모든 스와치 공통 스타일 (정사각형 유지) */
const baseSwatch: React.CSSProperties = {
  width: CELL,
  height: CELL,
  border: '1px solid #e5e7eb',
  borderRadius: 3,
  padding: 0,                 // ← 기본 padding 제거
  margin: 0,
  boxSizing: 'border-box',
  display: 'inline-block',
  cursor: 'pointer',
  appearance: 'none' as any,  // 브라우저 기본 스타일 제거
  WebkitAppearance: 'none' as any,
  MozAppearance: 'none' as any,
};

export default function CustomColorDropdown({
  value,
  onChange,
  onClose,
  recentColors,
  setRecentColors,
  kind = 'text'
}: Props) {
  const GRID = useMemo(buildColorGrid, []);
  const [showPicker, setShowPicker] = useState(false);
  const [hex, setHex] = useState<string>(value || '#000000');

  const title = kind === 'background' ? '최근 사용한 배경색' : '최근 사용한 글자색';

  const select = (c: string) => {
    onChange(c);
    if (c) {
      setRecentColors(prev => {
        const next = [c, ...prev.filter(x => x.toLowerCase() !== c.toLowerCase())];
        return next.slice(0, 16);
      });
      setHex(c);
    }
  };

  return (
    <div
      className="custom-color-dropdown editor-dropdown-menu"
      style={{
        position: 'absolute',
        top: 36,
        left: 0,
        width: CONTAINER_W,
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 10px 28px rgba(2, 8, 23, 0.08)',
        padding: PAD,
        zIndex: 1000,
        overflow: 'hidden'
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: '#1c1d1fa3' }}>
        {title}
      </div>

      {/* 최근 색상 (12칸) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gap: GAP,
          marginBottom: 10,
          width: GRID_W
        }}
      >
        {recentColors.slice(0, COLS).map(c => (
          <button
            key={c}
            onClick={() => select(c)}
            title={c}
            style={{ ...baseSwatch, background: c }}
          />
        ))}
      </div>

      {/* 지우기 + Grays */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gap: GAP,
          width: GRID_W
        }}
      >
        <button
          onClick={() => select('')}
          title="지우기"
          style={{
            ...baseSwatch,
            background:
              'linear-gradient(45deg, transparent 45%, #d33 45%, #d33 55%, transparent 55%), #fff'
          }}
        />
        {GRAYS.map(g => (
          <button
            key={g}
            onClick={() => select(g)}
            title={g}
            style={{ ...baseSwatch, background: g }}
          />
        ))}
      </div>

      {/* 12×7 컬러 그리드 */}
      <div style={{ marginTop: 8, display: 'grid', gap: GAP }}>
        {GRID.map((row, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
              gap: GAP,
              width: GRID_W
            }}
          >
            {row.map((c, i) => (
              <button
                key={`${rIdx}-${i}`}
                onClick={() => select(c)}
                title={c}
                style={{ ...baseSwatch, background: c }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 더보기 */}
      <button
        onClick={() => setShowPicker(v => !v)}
        style={{
          marginTop: 10,
          width: '100%',
          border: '1px solid #e5e7eb',
          background: '#f8fafc',
          color: '#1c1d1fa3',
          fontWeight: 600,
          borderRadius: 8,
          padding: '6px 8px',
          cursor: 'pointer'
        }}
      >
        더보기 {showPicker ? '▲' : '▼'}
      </button>

      {showPicker && (
        <div style={{ marginTop: 10 }}>
          <HexColorPicker
            color={hex}
            onChange={(c) => { setHex(c); select(c); }}
            style={{ width: '100%', height: 180, boxSizing: 'border-box', borderRadius: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onBlur={() => select(hex)}
              placeholder="#000000"
              style={{
                flex: 1,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 13,
                minWidth: 0
              }}
            />
            <button
              onClick={() => { select(hex); onClose(); }}
              style={{
                border: '1px solid #e2e8f0',
                background: '#fff',
                borderRadius: 8,
                padding: '6px 10px',
                fontWeight: 700,
                color: '#2563eb',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
