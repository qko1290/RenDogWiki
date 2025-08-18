// app/components/editor/PriceTableEditModal.tsx
'use client';

import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { ModalCard } from '@/components/common/Modal';

type PriceMode = 'normal' | 'awakening' | 'transcend';

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

function isFromItem(p: PriceTableEditModalProps): p is PropsFromItem {
  return 'item' in p;
}

function computeInitial(p: PriceTableEditModalProps) {
  if (isFromItem(p)) {
    const stages = p.item.stages?.length ? [...p.item.stages] : [...FIELD_LABELS.normal];
    const mode: PriceMode =
      stages.length === 1 ? 'normal' :
      stages.length === 2 ? 'transcend' :
      stages.length === 6 ? 'awakening' : 'normal';
    const prices = p.item.prices?.length ? [...p.item.prices] : new Array(stages.length).fill(0);
    return { mode, stages, prices };
  }
  const m: PriceMode = p.mode ?? 'normal';
  const stages = [...FIELD_LABELS[m]];
  const base = Array.isArray(p.prices) ? p.prices : [];
  const prices = base.length ? [...base] : new Array(stages.length).fill(0);
  return { mode: m, stages, prices };
}

export default function PriceTableEditModal(props: PriceTableEditModalProps) {
  // 🔔 모달 오픈 시 툴바 드롭다운만 닫기(스크롤 캡처는 카드 클릭 시점에 이미 수행)
  useLayoutEffect(() => {
    if (props.open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [props.open]);

  const memoInitial = useMemo(() => computeInitial(props), [props]);

  const [mode, setMode] = useState<PriceMode>(memoInitial.mode);
  const [stages, setStages] = useState<string[]>(memoInitial.stages);
  const [priceInputs, setPriceInputs] = useState<string[]>(
    memoInitial.prices.map(v => (Number.isFinite(v as number) ? String(v) : '0'))
  );

  useEffect(() => {
    if (!props.open) return;
    const init = computeInitial(props);
    setMode(init.mode);
    setStages(init.stages);
    setPriceInputs(init.prices.map(v => (Number.isFinite(v as number) ? String(v) : '0')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const switchMode = (m: PriceMode) => {
    setMode(m);
    const s = FIELD_LABELS[m];
    setStages([...s]);
    setPriceInputs(prev => {
      const next = [...prev];
      next.length = s.length;
      for (let i = 0; i < s.length; i++) if (typeof next[i] === 'undefined') next[i] = '0';
      return next;
    });
  };

  const handleChange = (idx: number, val: string) => {
    setPriceInputs(prev => {
      const next = [...prev];
      let cleaned = val.replace(/[^\d.-]/g, '');
      if ((cleaned.match(/-/g) || []).length > 1) cleaned = cleaned.replace(/-(?=.+-)/g, '');
      if ((cleaned.match(/\./g) || []).length > 1) cleaned = cleaned.replace(/\.(?=.+\.)/g, '');
      next[idx] = cleaned;
      return next;
    });
  };

  const handleSave = () => {
    const len = stages.length;
    const norm = [...priceInputs];
    norm.length = len;
    for (let i = 0; i < len; i++) if (typeof norm[i] === 'undefined') norm[i] = '0';
    const prices = norm.map(v => {
      const n = parseFloat(v);
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
              height: 34, minWidth: 64, borderRadius: 999,
              background: m === mode ? '#2563eb' : '#f3f4f6',
              color: m === mode ? '#fff' : '#475569', fontWeight: 800,
            }}
            aria-pressed={m === mode}
            title={`${label} 모드`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* 단계 라벨 + 입력 */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12, columnGap: 12 }}>
        {stages.map((label, i) => (
          <React.Fragment key={`${label}-${i}`}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#1f2937', fontWeight: 800 }}>
              {label}
            </div>
            <input
              className="rd-input"
              type="number"
              inputMode="decimal"
              value={priceInputs[i] ?? ''}
              onChange={e => handleChange(i, e.target.value)}
              placeholder="0"
              aria-label={`${label} 가격`}
            />
          </React.Fragment>
        ))}
      </div>
    </ModalCard>
  );
}
