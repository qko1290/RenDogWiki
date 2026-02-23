// =============================================
// File: components/wiki/HeadGrid.tsx
// =============================================
"use client";

import React, { useState } from "react";
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
  headIcon?: string | null;
};

export default function HeadGrid({
  heads,
  onClick,
  selectedHeadId,
  headIcon,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)", // ✅ 6열 유지
        gap: 20,
        margin: "20px 0",
      }}
    >
      {heads.slice(0, 24).map((head) => {
        const hovered = hoveredId === head.id;

        const villageIcon =
          headIcon && headIcon.trim().length > 0 ? headIcon.trim() : null;

        const headPicture =
          Array.isArray(head.pictures) && head.pictures.length > 0
            ? head.pictures[0]
            : null;

        const thumbSrc = villageIcon ?? headPicture;

        const coordText = `(${head.location_x}, ${head.location_y}, ${head.location_z})`;

        // ✅ 요청한 hover 스타일 그대로 사용
        const BORDER = hovered ? "1.5px solid #93c5fd" : "1.5px solid #d1d5db";
        const SHADOW = hovered
          ? "0 12px 28px rgba(2, 132, 199, 0.16), 0 3px 8px rgba(15, 23, 42, 0.08)"
          : "0 10px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.05)";

        const selected = selectedHeadId === head.id;

        return (
          <div
            key={head.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",

              border: BORDER,
              borderRadius: 12,
              height: 125,
              cursor: "pointer",
              background: selected ? "#e7f6ff" : "#fff",
              boxShadow: SHADOW,
              padding: "8px 6px",
              textAlign: "center",

              transform: hovered ? "translateY(-2px)" : "translateY(0)",
              transition:
                "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
            }}
            onMouseEnter={() => setHoveredId(head.id)}
            onMouseLeave={() => setHoveredId((prev) => (prev === head.id ? null : prev))}
            onClick={() => onClick?.(head)}
          >
            {thumbSrc ? (
              <img
                src={toProxyUrl(thumbSrc)}
                alt={`${head.order}번 머리`}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  objectFit: "cover",
                  background: "#fff",
                }}
              />
            ) : (
              <span style={{ fontSize: 38, color: "#bbb" }}>🪖</span>
            )}

            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#111",
                marginTop: 6,
                fontFamily: "Pretendard, Malgun Gothic, sans-serif",
              }}
            >
              {head.order}번
            </div>

            {/* ✅ 좌표 전체 표시 (세로로 한 글자씩 깨지는 현상 방지) */}
            <div
              style={{
                fontSize: 13,
                color: "#555",
                marginTop: 4,
                lineHeight: "16px",

                // 🔥 핵심: break-word 때문에 숫자가 한 글자씩 세로로 내려가던 문제 해결
                wordBreak: "keep-all",
                overflowWrap: "anywhere",

                fontVariantNumeric: "tabular-nums",
              }}
            >
              {coordText}
            </div>
          </div>
        );
      })}
    </div>
  );
}