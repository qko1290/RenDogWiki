// =============================================
// File: app/components/editor/PriceTableEditModal.tsx
// =============================================
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModalCard } from '@/components/common/Modal';

type PriceMode = 'normal' | 'awakening' | 'transcend';

// 각 가격 모드별 필드명
const FIELD_LABELS: Record<PriceMode, string[]> = {
  normal: ['가격'],
  awakening: ['봉인', '1각', '2각', '3각', '4각', 'MAX'],
  transcend: ['거가', '거불'],
};

type CardItem = {
  name?: string;
  image?: string | null;
  stages?: string[];
  prices?: number[];
  colorType?: 'default' | 'green' | 'yellow' | string;
};

type PropsFromItem = {
  open: boolean;
  item: CardItem;
  onClose: () => void;
  onSave: (data: { stages: string[]; prices: number[] }) => void;
};

type PropsFromValues = {
  open: boolean;
  mode: PriceMode;
  prices: number[];
  onClose: () => void;
  onSave: (data: { stages: string[]; prices: number[] }) => void;
};

type PriceTableEditModalProps = PropsFromItem | PropsFromValues;

/** 시세/강화수치 편집 모달(카드형) */
export default function PriceTableEditModal(props: PriceTableEditModalProps) {
  // 모달 열릴 때 툴바 드롭다운 닫기
  useEffect(() => {
    if (props.open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [props.open]);

  // 초기 모드/필드/가격 계산
  const initial = useMemo(() => {
    if ('item' in props && props.item) {
      const stages =
        props.item.stages && props.item.stages.length
          ? [...props.item.stages]
          : [...FIELD_LABELS.normal];

      const mode: PriceMode =
        stages.length === 1 ? 'normal' :
        stages.length === 2 ? 'transcend' :
        stages.length === 6 ? 'awakening' : 'normal';

      const prices =
        Array.isArray(props.item.prices) && props.item.prices.length
          ? props.item.prices
          : new Array(stages.length).fill(0);

      return { mode, stages, prices };
    } else {
      const mode = (props as PropsFromValues).mode ?? 'normal';
      const stages = [...FIELD_LABELS[mode]];
      const p = (props as PropsFromValues).prices ?? [];
      const prices = p.length ? p : new Array(stages.length).fill(0);
      return { mode, stages, prices };
    }
  }, [props]);

  const [mode, setMode] = useState<PriceMode>(initial.mode);
  const [stages, setStages] = useState<string[]>(initial.stages);
  const [priceInputs, setPriceInputs] = useState<string[]>(
    initial.prices.map(v => (Number.isFinite(v as number) ? String(v) : '0'))
  );

  // 모드 탭 전환
  const switchMode = (m: PriceMode) => {
    setMode(m);
    const s = FIELD_LABELS[m];
    setStages([...s]);

    setPriceInputs(prev => {
      const next = [...prev];
      next.length = s.length;
      for (let i = 0; i < s.length; i++) {
        if (typeof next[i] === 'undefined') next[i] = '0';
      }
      return next;
    });
  };

  const handleChange = (idx: number, val: string) => {
    setPriceInputs(prev => {
      const next = [...prev];
      next[idx] = val.replace(/[^\d.-]/g, ''); // 숫자/부호만
      return next;
    });
  };

  const handleSave = () => {
    const prices = priceInputs.map(v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
    props.onSave({ stages, prices });
  };

  return (
    <ModalCard
      open={props.open}
      onClose={props.onClose}
      title="가격/강화수치 편집"
      width={560}
      actions={
        <>
          <button className="rd-btn secondary" onClick={props.onClose}>취소</button>
          <button className="rd-btn primary" onClick={handleSave}>저장</button>
        </>
      }
    >
      {/* 모드 탭 */}
      <div style={{ display: 'flex', gap: 8, margin: '6px 0 12px auto' }}>
        {([
          ['normal', '일반'],
          ['awakening', '각성'],
          ['transcend', '초월'],
        ] as [PriceMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className="rd-btn"
            style={{
              height: 34,
              minWidth: 64,
              borderRadius: 999,
              background: m === mode ? '#2563eb' : '#f3f4f6',
              color: m === mode ? '#fff' : '#475569',
              fontWeight: 800,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 필드들 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          rowGap: 12,
          columnGap: 12,
        }}
      >
        {stages.map((label, i) => (
          <React.Fragment key={`${label}-${i}`}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#1f2937',
                fontWeight: 800,
              }}
            >
              {label}
            </div>
            <input
              className="rd-input"
              type="number"
              inputMode="numeric"
              value={priceInputs[i] ?? ''}
              onChange={e => handleChange(i, e.target.value)}
              placeholder="0"
            />
          </React.Fragment>
        ))}
      </div>
    </ModalCard>
  );
}
