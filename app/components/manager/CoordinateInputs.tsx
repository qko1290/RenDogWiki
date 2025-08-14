// =============================================
// File: app/components/manager/CoordinateInputs.tsx
// =============================================
/**
 * 좌표(X, Y, Z) 숫자 입력 컴포넌트
 * - 배열 튜플 [x, y, z] 값을 입력/수정하고 부모 onChange로 전달
 * - compact 플래그로 레이아웃 클래스 전환
 * - 접근성: 각 입력을 시각 라벨과 programmatic하게 연결(aria-labelledby)
 */

'use client';

import React, { useId } from 'react';

type Coord = [number, number, number];

// 라벨은 고정값이므로 컴포넌트 바깥으로 승격해 재생성 방지
const LABELS = ['X', 'Y', 'Z'] as const;

export const CoordinateInputs = React.memo(function CoordinateInputs({
  value,
  onChange,
  compact,
}: {
  value: Coord;
  onChange: (v: Coord) => void;
  compact?: boolean;
}) {
  const baseId = useId();

  return (
    <div className={compact ? 'coords-row compact' : 'coords-row'}>
      {LABELS.map((label, idx) => {
        const labelId = `${baseId}-label-${label}`;
        return (
          <div key={label} className="coords-col">
            {/* 시각 라벨 + 스크린리더 연결용 id */}
            <div id={labelId} className="coords-label">
              {label}
            </div>
            <input
              type="number"
              className="coords-input"
              value={value[idx]}
              onChange={(e) => {
                const copy = [...value] as Coord;
                copy[idx] = Number(e.currentTarget.value);
                onChange(copy);
              }}
              aria-labelledby={labelId}
              inputMode="decimal"
            />
          </div>
        );
      })}
    </div>
  );
});
