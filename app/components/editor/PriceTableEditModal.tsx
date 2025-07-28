// =============================================
// File: app/components/editor/PriceTableEditModal.tsx
// =============================================

import React, { useState } from 'react';

// 각 가격 모드별 필드명 정의
const FIELD_LABELS = {
  normal: ['가격'],
  awakening: ['봉인', '1각', '2각', '3각', '4각', 'MAX'],
  transcend: ['거가', '거불'],
};

type PriceMode = 'normal' | 'awakening' | 'transcend';

// item 기반(슬레이트 카드 블록 등)과 mode/prices 기반(외부 호출 등) 모두 지원
type PriceTableEditModalProps =
  | {
      open: boolean;
      item: {
        mode?: PriceMode;
        stages?: string[];
        prices?: number[];
      };
      mode?: never;
      prices?: never;
      onClose: () => void;
      onSave: (data: { stages: string[]; prices: number[] }) => void;
    }
  | {
      open: boolean;
      item?: never;
      mode: PriceMode;
      prices: number[];
      onClose: () => void;
      onSave: (data: { stages: string[]; prices: number[] }) => void;
    };

// 가격/강화수치 편집 모달
export default function PriceTableEditModal(props: PriceTableEditModalProps) {
  if (!props.open) return null;

  // item 또는 mode/prices 기반으로 초기 상태 구성
  let initialMode: PriceMode;
  let initialStages: string[];
  let initialPrices: number[];

  if ('item' in props && props.item) {
    initialMode = props.item.mode ?? 'normal';
    initialStages = props.item.stages ?? FIELD_LABELS[initialMode];
    initialPrices =
      Array.isArray(props.item.prices) && props.item.prices.length
        ? props.item.prices
        : Array(initialStages.length).fill(0);
  } else {
    initialMode = props.mode ?? 'normal';
    initialStages = FIELD_LABELS[initialMode];
    initialPrices =
      Array.isArray(props.prices) && props.prices.length
        ? props.prices
        : Array(initialStages.length).fill(0);
  }

  // 모드 및 가격 필드 상태
  const [mode, setMode] = useState<PriceMode>(initialMode);
  const [prices, setPrices] = useState<string[]>(
    initialPrices.length
      ? initialPrices.map(String)
      : Array(FIELD_LABELS[initialMode].length).fill('')
  );

  // 모드(일반/각성/초월) 변경시 가격 필드도 초기화
  const handleModeChange = (newMode: PriceMode) => {
    setMode(newMode);
    setPrices(Array(FIELD_LABELS[newMode].length).fill(''));
  };

  // 저장 버튼 클릭시 콜백 호출
  const handleSave = () => {
    props.onSave({
      stages: FIELD_LABELS[mode],
      prices: prices.map((p) => Number(p) || 0),
    });
  };

  // 실제 모달 UI
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1000,
        background: "rgba(0,0,0,0.20)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 32px #0002",
          minWidth: 320,
          minHeight: 220,
          position: "relative",
        }}
      >
        {/* 상단: 제목 및 모드 선택 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <b style={{ fontSize: 18 }}>가격/강화수치 편집</b>
          <div style={{ display: "flex", gap: 4 }}>
            {(['normal', 'awakening', 'transcend'] as PriceMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                style={{
                  padding: "4px 14px",
                  fontWeight: mode === m ? 700 : 400,
                  borderRadius: 12,
                  background: mode === m ? "#377dff" : "#eee",
                  color: mode === m ? "#fff" : "#222",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m === "normal"
                  ? "일반"
                  : m === "awakening"
                  ? "각성"
                  : "초월"}
              </button>
            ))}
          </div>
        </div>

        {/* 가격 입력 테이블 */}
        <table style={{ width: "100%", marginBottom: 20 }}>
          <tbody>
            {FIELD_LABELS[mode].map((label, i) => (
              <tr key={label}>
                <td style={{ padding: 6, textAlign: "right", fontWeight: 600 }}>
                  {label}
                </td>
                <td style={{ padding: 6 }}>
                  <input
                    type="number"
                    style={{
                      width: 90,
                      padding: 7,
                      fontSize: 15,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                    }}
                    value={prices[i] ?? ""}
                    onChange={(e) => {
                      const arr = [...prices];
                      arr[i] = e.target.value.replace(/[^0-9]/g, "");
                      setPrices(arr);
                    }}
                    placeholder="가격"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 하단 버튼 영역 */}
        <div style={{ textAlign: "right", marginTop: 18 }}>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 22px",
              borderRadius: 8,
              background: "#377dff",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              marginRight: 8,
              fontSize: 16,
            }}
          >
            저장
          </button>
          <button
            onClick={props.onClose}
            style={{
              padding: "8px 22px",
              borderRadius: 8,
              background: "#f7f7f7",
              color: "#333",
              border: "1px solid #ddd",
              fontWeight: 500,
              fontSize: 16,
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
