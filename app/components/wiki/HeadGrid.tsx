// =============================================
// File: components/wiki/HeadGrid.tsx
// (6열 + 좌표 전체 표시 + 깔끔한 카드 UI + hover border/shadow)
// =============================================
"use client";

import React, { useMemo, useState } from "react";
import { toProxyUrl } from "@lib/cdn";

export type Head = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  heads: Head[];
  onClick?: (head: Head) => void;
  selectedHeadId?: number | null;
  /** 현재 머리들이 속한 마을의 공통 head 아이콘 (village.head_icon) */
  headIcon?: string | null;
};

export default function HeadGrid({
  heads,
  onClick,
  selectedHeadId,
  headIcon,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const villageIcon = useMemo(() => {
    const v = headIcon?.trim();
    return v && v.length > 0 ? v : null;
  }, [headIcon]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)", // ✅ 6열
        gap: 18,
        margin: "20px 0",
      }}
    >
      {heads.map((head) => {
        const hovered = hoveredId === head.id;
        const selected = selectedHeadId === head.id;

        const headPicture =
          Array.isArray(head.pictures) && head.pictures.length > 0
            ? head.pictures[0]
            : null;

        const thumbSrc = villageIcon ?? headPicture;

        // ✅ 좌표는 전부 보이게(말줄임 X), 줄바꿈은 허용
        const coordText = `(${head.location_x}, ${head.location_y}, ${head.location_z})`;

        // ✅ 요청한 hover 스타일 그대로 사용
        const BORDER = hovered ? "1.5px solid #93c5fd" : "1.5px solid #d1d5db";
        const SHADOW = hovered
          ? "0 12px 28px rgba(2, 132, 199, 0.16), 0 3px 8px rgba(15, 23, 42, 0.08)"
          : "0 10px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.05)";

        // 선택 상태는 “깔끔하게”만 강조 (과하지 않게)
        const selectedRing = selected ? "0 0 0 3px rgba(147, 197, 253, 0.35)" : "none";
        const bg = selected ? "#f8fbff" : "#fff";

        return (
          <div
            key={head.id}
            onClick={() => onClick?.(head)}
            onMouseEnter={() => setHoveredId(head.id)}
            onMouseLeave={() => setHoveredId((prev) => (prev === head.id ? null : prev))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              borderRadius: 14,
              border: BORDER,
              background: bg,
              boxShadow: SHADOW,
              outline: selectedRing,
              cursor: "pointer",
              transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
              transform: hovered ? "translateY(-2px)" : "translateY(0)",
              minWidth: 0,
            }}
          >
            {/* 왼쪽 아이콘 */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "#eef2ff",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
              }}
            >
              {thumbSrc ? (
                <img
                  src={toProxyUrl(thumbSrc)}
                  alt={`${head.order}번 머리`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    objectFit: "cover",
                    background: "#fff",
                  }}
                />
              ) : (
                <span style={{ fontSize: 20, color: "#94a3b8" }}>🪖</span>
              )}
            </div>

            {/* 가운데 텍스트 */}
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: 0.2,
                  lineHeight: "20px",
                  fontFamily: "Pretendard, Malgun Gothic, sans-serif",
                }}
              >
                {head.order}번
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  color: "#64748b",
                  lineHeight: "16px",
                  // ✅ 좌표는 전부 보이게: 말줄임 X
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
              >
                {coordText}
              </div>
            </div>

            {/* 오른쪽 화살표 */}
            <div
              style={{
                flex: "0 0 auto",
                width: 28,
                height: 28,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                color: hovered ? "#2563eb" : "#94a3b8",
                transition: "color 140ms ease, transform 140ms ease",
                transform: hovered ? "translateX(1px)" : "translateX(0)",
              }}
              aria-hidden
            >
              {/* 간단한 chevron-right */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}