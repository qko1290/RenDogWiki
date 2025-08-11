// app/components/manager/CoordinateInputs.tsx
'use client';
import React from 'react';

type Coord = [number, number, number];

export function CoordinateInputs({
  value,
  onChange,
  compact,
}: {
  value: Coord;
  onChange: (v: Coord) => void;
  compact?: boolean;
}) {
  const labels = ['X', 'Y', 'Z'] as const;
  return (
    <div className={compact ? 'coords-row compact' : 'coords-row'}>
      {labels.map((label, idx) => (
        <div key={label} className="coords-col">
          <div className="coords-label">{label}</div>
          <input
            type="number"
            className="coords-input"
            value={value[idx]}
            onChange={(e) => {
              const copy = [...value] as Coord;
              copy[idx] = Number(e.target.value);
              onChange(copy);
            }}
          />
        </div>
      ))}
    </div>
  );
}
