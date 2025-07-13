// File: app/components/editor/CustomColorDropdown.tsx
'use client';

import React, { useState, useRef } from "react";
import { HexColorPicker } from "react-colorful";

const PALETTE_COLORS = [
  "#000000", "#ffffff", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#00FFFF", "#FF00FF", "#808080", "#C0C0C0",
  // ... 더 추가 가능
];

export default function CustomColorDropdown({
  value,
  onChange,
  onClose,
  recentColors,
  setRecentColors,
}: {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
  recentColors: string[];
  setRecentColors: (colors: string[]) => void;
}) {
  // === draftColor: 미리보기 용 ===
  const [draftColor, setDraftColor] = useState(value || "#000000");
  const isMouseDown = useRef(false);

  // 팔레트/최근색 클릭시 바로 적용
  const handleColor = (color: string) => {
    setDraftColor(color);
    onChange(color);
    if (color && !recentColors.includes(color)) {
      setRecentColors([color, ...recentColors.slice(0, 7)]);
    }
  };

  // Picker에서 손 뗄 때만 최종 적용
  const handlePointerUp = () => {
    onChange(draftColor);
    if (draftColor && !recentColors.includes(draftColor)) {
      setRecentColors([draftColor, ...recentColors.slice(0, 7)]);
    }
  };

  // HEX 입력에서 엔터/blur 시 적용
  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftColor(e.target.value);
  };
  const applyHexInput = () => {
    onChange(draftColor);
    if (draftColor && !recentColors.includes(draftColor)) {
      setRecentColors([draftColor, ...recentColors.slice(0, 7)]);
    }
  };

  return (
    <div
      style={{
        width: 220,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 10,
        boxShadow: "0 6px 24px #0001",
        padding: 14,
        zIndex: 50,
        position: "absolute",
        top: 36,
        left: 0,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ marginBottom: 8, fontSize: 13 }}>최근 사용한 글자색</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {recentColors.map((c, i) => (
          <div
            key={c + i}
            style={{
              width: 20,
              height: 20,
              background: c,
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: "pointer"
            }}
            onClick={() => handleColor(c)}
          />
        ))}
      </div>
      <div style={{ marginBottom: 8, fontSize: 13 }}>팔레트</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
        {PALETTE_COLORS.map((c) => (
          <div
            key={c}
            style={{
              width: 20,
              height: 20,
              background: c,
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: "pointer"
            }}
            onClick={() => handleColor(c)}
          />
        ))}
        {/* "없앰" 버튼 */}
        <div
          style={{
            width: 20, height: 20, border: "1px solid #ccc", borderRadius: 4,
            background: "linear-gradient(135deg, #fff 70%, #f33 100%)",
            position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}
          title="색상 없음"
          onClick={() => handleColor("")}
        >
          <span style={{
            color: "#f33", fontWeight: "bold", fontSize: 16, lineHeight: 1,
            position: "absolute", left: 3, top: 2
          }}>&times;</span>
        </div>
      </div>
      {/* 고급 선택 (Color Picker) */}
      <div
        onPointerDown={() => (isMouseDown.current = true)}
        onPointerUp={() => {
          if (isMouseDown.current) {
            isMouseDown.current = false;
            handlePointerUp();
          }
        }}
        onMouseLeave={() => {
          if (isMouseDown.current) {
            isMouseDown.current = false;
            handlePointerUp();
          }
        }}
        style={{ marginBottom: 8 }}
      >
        <HexColorPicker
          color={draftColor}
          onChange={setDraftColor}
        />
      </div>
      {/* HEX 입력 */}
      <input
        type="text"
        value={draftColor}
        onChange={handleHexInput}
        onBlur={applyHexInput}
        onKeyDown={e => {
          if (e.key === "Enter") {
            applyHexInput();
          }
        }}
        placeholder="#000000"
        style={{ width: 90, padding: 4, fontSize: 14, border: "1px solid #ccc", borderRadius: 4, marginBottom: 8 }}
      />
      <button onClick={onClose} style={{ float: "right", marginTop: -34, background: "#eee", border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer" }}>닫기</button>
    </div>
  );
}
