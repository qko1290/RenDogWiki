// =============================================
// File: components/wiki/HeadGrid.tsx
// (6열 + 좌표 전체 표시 + 카드 UI 개선)
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
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 18,
        margin: "20px 0",
      }}
    >
      {heads.map((head) => {
        const isSelected = selectedHeadId === head.id;

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
            onClick={() => onClick?.(head)}
            style={{
              cursor: "pointer",
              borderRadius: 16,
              padding: 10,
              height: 132,
              position: "relative",
              userSelect: "none",

              background: isSelected
                ? "linear-gradient(180deg, #eff8ff 0%, #ffffff 70%)"
                : "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)",

              border: isSelected ? "1px solid #78c7ff" : "1px solid #e6e6e6",
              boxShadow: isSelected
                ? "0 10px 24px rgba(35, 140, 255, 0.12)"
                : "0 8px 18px rgba(0, 0, 0, 0.06)",

              transition:
                "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = isSelected
                ? "0 12px 26px rgba(35, 140, 255, 0.14)"
                : "0 12px 26px rgba(0, 0, 0, 0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "none";
              (e.currentTarget as HTMLDivElement).style.boxShadow = isSelected
                ? "0 10px 24px rgba(35, 140, 255, 0.12)"
                : "0 8px 18px rgba(0, 0, 0, 0.06)";
            }}
          >
            {/* 상단 작은 배지 */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                fontSize: 12,
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: 999,
                background: isSelected ? "#dff3ff" : "#f2f2f2",
                color: isSelected ? "#0b74b8" : "#666",
                border: isSelected ? "1px solid #bfe9ff" : "1px solid #e8e8e8",
                letterSpacing: 0.2,
              }}
            >
              #{head.order}
            </div>

            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                textAlign: "center",
              }}
            >
              {/* 썸네일 래퍼 */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background: isSelected
                    ? "linear-gradient(180deg, #e7f6ff 0%, #ffffff 100%)"
                    : "linear-gradient(180deg, #f6f6f6 0%, #ffffff 100%)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
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
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      objectFit: "cover",
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 32, color: "#bdbdbd" }}>🪖</span>
                )}
              </div>

              {/* 큰 제목 */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#111",
                  letterSpacing: 0.2,
                  fontFamily: "Pretendard, Malgun Gothic, sans-serif",
                }}
              >
                {head.order}번
              </div>

              {/* 좌표 (전부 표시, 줄바꿈 OK) */}
              <div
                style={{
                  fontSize: 13,
                  color: "#5b5b5b",
                  lineHeight: "16px",
                  padding: "0 6px",
                  wordBreak: "break-word",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
              >
                {coordText}
              </div>
            </div>

            {/* 선택 링(오른쪽 위 점) */}
            {isSelected && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#2aa8ff",
                  boxShadow: "0 0 0 4px rgba(42,168,255,0.18)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}