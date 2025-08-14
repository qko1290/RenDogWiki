// =============================================
// File: app/components/editor/PriceTableEditModal.tsx
// =============================================
'use client';

/**
 * 시세/강화수치 편집 모달(카드형)
 * - 모드: normal(단일), awakening(봉인~MAX 6단계), transcend(거가/거불 2단계)
 * - 모달이 열릴 때만 현재 props 기준으로 상태를 재초기화(편집 도중 외부 값 변화를 덮어쓰지 않음)
 * - 저장 시 stages/prices를 동일 길이로 반환
 */

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

/** 유니온 분기를 위한 타입 가드 */
function isFromItem(p: PriceTableEditModalProps): p is PropsFromItem {
  return 'item' in p;
}

// 내부 초기값 계산 유틸(모달이 열릴 때 사용)
function computeInitial(p: PriceTableEditModalProps) {
  if (isFromItem(p)) {
    const stages =
      p.item.stages && p.item.stages.length
        ? [...p.item.stages]
        : [...FIELD_LABELS.normal];

    const mode: PriceMode =
      stages.length === 1 ? 'normal' :
      stages.length === 2 ? 'transcend' :
      stages.length === 6 ? 'awakening' : 'normal';

    const prices =
      Array.isArray(p.item.prices) && p.item.prices.length
        ? [...p.item.prices]
        : new Array(stages.length).fill(0);

    return { mode, stages, prices };
  }

  // PropsFromValues 분기
  const m: PriceMode = p.mode ?? 'normal';
  const stages = [...FIELD_LABELS[m]];
  const basePrices = Array.isArray(p.prices) ? p.prices : [];
  const prices = basePrices.length ? [...basePrices] : new Array(stages.length).fill(0);
  return { mode: m, stages, prices };
}

/** 시세/강화수치 편집 모달(카드형) */
export default function PriceTableEditModal(props: PriceTableEditModalProps) {
  // 모달 열릴 때 툴바 드롭다운 닫기
  useEffect(() => {
    if (props.open) {
      window.dispatchEvent(new CustomEvent('editor:close-dropdowns'));
    }
  }, [props.open]);

  // 한 번 계산해두고, 실제 초기화는 open 변화에 맞춰 수행
  const memoInitial = useMemo(() => computeInitial(props), [props]);

  // 편집 상태
  const [mode, setMode] = useState<PriceMode>(memoInitial.mode);
  const [stages, setStages] = useState<string[]>(memoInitial.stages);
  const [priceInputs, setPriceInputs] = useState<string[]>(
    memoInitial.prices.map(v => (Number.isFinite(v as number) ? String(v) : '0'))
  );

  // 모달이 열릴 때마다 최신 props로 상태 재초기화
  useEffect(() => {
    if (!props.open) return;
    const init = computeInitial(props);
    setMode(init.mode);
    setStages(init.stages);
    setPriceInputs(init.prices.map(v => (Number.isFinite(v as number) ? String(v) : '0')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // 모드 탭 전환
  const switchMode = (m: PriceMode) => {
    setMode(m);
    const s = FIELD_LABELS[m];
    setStages([...s]);
    // 기존 값 최대한 유지, 부족분은 0으로 채움/초과분은 자름
    setPriceInputs(prev => {
      const next = [...prev];
      next.length = s.length;
      for (let i = 0; i < s.length; i++) {
        if (typeof next[i] === 'undefined') next[i] = '0';
      }
      return next;
    });
  };

  // 숫자 입력 정규화(숫자/소수점/부호만 허용)
  const handleChange = (idx: number, val: string) => {
    setPriceInputs(prev => {
      const next = [...prev];
      // 여러 개의 '-'나 '.'을 연달아 입력하는 경우를 최소한으로 방어
      let cleaned = val.replace(/[^\d.-]/g, '');
      const minusCount = (cleaned.match(/-/g) || []).length;
      if (minusCount > 1) cleaned = cleaned.replace(/-(?=.+-)/g, '');
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount > 1) cleaned = cleaned.replace(/\.(?=.+\.)/g, '');
      next[idx] = cleaned;
      return next;
    });
  };

  const handleSave = () => {
    // 저장 시 길이 맞추기
    const len = stages.length;
    const normalized = [...priceInputs];
    normalized.length = len;
    for (let i = 0; i < len; i++) {
      if (typeof normalized[i] === 'undefined') normalized[i] = '0';
    }
    const prices = normalized.map(v => {
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
              height: 34,
              minWidth: 64,
              borderRadius: 999,
              background: m === mode ? '#2563eb' : '#f3f4f6',
              color: m === mode ? '#fff' : '#475569',
              fontWeight: 800,
            }}
            aria-pressed={m === mode}
            title={`${label} 모드`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* 단계 라벨 + 입력 필드 */}
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
