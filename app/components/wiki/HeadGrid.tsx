// =============================================
// File: components/wiki/HeadGrid.tsx
// =============================================
import React from "react";
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
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)", // ✅ 6열로 변경
        gap: 20,
        margin: "20px 0",
      }}
    >
      {heads.map((head) => {
        const villageIcon =
          headIcon && headIcon.trim().length > 0 ? headIcon.trim() : null;

        const headPicture =
          Array.isArray(head.pictures) && head.pictures.length > 0
            ? head.pictures[0]
            : null;

        const thumbSrc = villageIcon ?? headPicture;

        const coordText = `(${head.location_x}, ${head.location_y}, ${head.location_z})`;

        return (
          <div
            key={head.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid #ddd",
              borderRadius: 12,
              height: 125, // ✅ 높이 증가 (좌표 여유 확보)
              cursor: "pointer",
              background: selectedHeadId === head.id ? "#e7f6ff" : "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              padding: "8px 6px",
              textAlign: "center",
            }}
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

            {/* ✅ 좌표 전체 표시 (줄바꿈 허용) */}
            <div
              style={{
                fontSize: 13,
                color: "#555",
                marginTop: 4,
                lineHeight: "16px",
                wordBreak: "break-word", // 좌표가 길어도 안전
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