// =============================================
// File: app/components/editor/PriceTableEditModal.tsx  (전체 코드)
// =============================================
'use client';

import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { ModalCard } from '@/components/common/Modal';
import type { PriceTableMode } from '@/types/slate'; // 경로가 다르면 맞춰줘

// ✅ 저장 payload (기존 호환을 위해 stages도 유지)
type SavePayload = { stages: string[]; prices: string[] };

const STAGES_SINGLE = ['가격'] as const;
const STAGES_AWAKENING = ['봉인', '1각', '2각', '3각', '4각', 'MAX'] as const;
const STAGES_TRANSCEND = ['거가', '거불'] as const;

function getStagesByMode(mode: PriceTableMode | string | undefined): string[] {
  const m = String(mode ?? '');

  // 초월
  if (m.startsWith('transcend_') || m.startsWith('transcend ')) return [...STAGES_TRANSCEND];

  // 각성(에픽~슈페리어)
  if (['epic', 'unique', 'legendary', 'divine', 'superior'].includes(m)) return [...STAGES_AWAKENING];

  // 단일
  return [...STAGES_SINGLE];
}

type CardItem = {
  name?: string;
  image?: string | null;
  mode?: PriceTableMode;
  prices?: string[] | Array<string | number>;
  colorType?: 'default' | 'green' | 'yellow' | string;
};

type Props = {
  open: boolean;
  item: CardItem;
  onClose: () => void;
  onSave: (data: SavePayload) => void;
};

function computeInitial(item: CardItem) {
  const stages = getStagesByMode(item.mode);
  const raw = Array.isArray(item.prices) ? item.prices : [];
  const prices =
    raw.length > 0 ? raw.map((v) => String(v ?? '')) : new Array(stages.length).fill('');

  // 길이 보정
  if (prices.length !== stages.length) {
    const next = [...prices];
    next.length = stages.length;
    for (let i = 0; i < stages.length; i++) {
      if (typeof next[i] === 'undefined') next[i] = '';
    }
    return { stages, prices: next };
  }

  return { stages, prices };
}

export default function PriceTableEditModal({ open, item, onClose, onSave }: Props) {
  // 🔔 모달 오픈 시 툴바 드롭다운만 닫기
  useLayoutEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
  }, [open]);

  const memoInitial = useMemo(() => computeInitial(item), [item]);

  const [stages, setStages] = useState<string[]>(memoInitial.stages);
  const [priceInputs, setPriceInputs] = useState<string[]>(memoInitial.prices);

  useEffect(() => {
    if (!open) return;
    const init = computeInitial(item);
    setStages(init.stages);
    setPriceInputs(init.prices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleChange = (idx: number, val: string) => {
    setPriceInputs((prev) => {
      const next = [...prev];
      next[idx] = val; // "~" 포함 문자열 OK
      return next;
    });
  };

  const handleSave = () => {
    const len = stages.length;

    const norm = [...priceInputs];
    norm.length = len;
    for (let i = 0; i < len; i++) {
      if (typeof norm[i] === 'undefined') norm[i] = '';
    }

    const prices = norm.map((v) => String(v ?? '').trim());
    onSave({ stages, prices });
  };

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      title="가격 편집"
      width={560}
      actions={
        <>
          <button className="rd-btn secondary" onClick={onClose}>
            취소
          </button>
          <button className="rd-btn primary" onClick={handleSave}>
            저장
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
        형식은 카드의 아이템(mode)에 따라 자동으로 결정됩니다. (예: 각성=봉인~MAX, 초월=거가/거불)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12, columnGap: 12 }}>
        {stages.map((label, i) => (
          <React.Fragment key={`${label}-${i}`}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#1f2937', fontWeight: 900 }}>
              {label}
            </div>
            <input
              className="rd-input"
              type="text"
              inputMode="text"
              value={priceInputs[i] ?? ''}
              onChange={(e) => handleChange(i, e.target.value)}
              placeholder="예) 51~52"
              aria-label={`${label} 가격`}
            />
          </React.Fragment>
        ))}
      </div>
    </ModalCard>
  );
}