// =============================================
// File: components/wiki/HeadGrid.tsx
// (6열 + 좌표 전체 표시 + Game UI 스타일)
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

        const baseBorder = isSelected ? "#35b6ff" : "rgba(0,0,0,0.18)";
        const innerBorder = isSelected ? "rgba(53,182,255,0.65)" : "rgba(255,255,255,0.10)";

        return (
          <div
            key={head.id}
            onClick={() => onClick?.(head)}
            style={{
              position: "relative",
              height: 140,
              borderRadius: 14,
              cursor: "pointer",
              userSelect: "none",
              padding: 10,
              textAlign: "center",

              // 게임 UI 프레임 느낌: 어두운 베이스 + 미세한 그라데이션
              background:
                "linear-gradient(180deg, rgba(32,36,44,0.95) 0%, rgba(20,22,28,0.98) 100%)",

              // 바깥 프레임 테두리
              border: `1px solid ${baseBorder}`,

              // 깊이감(그림자) + 선택 글로우
              boxShadow: isSelected
                ? "0 0 0 3px rgba(53,182,255,0.22), 0 14px 28px rgba(0,0,0,0.35)"
                : "0 14px 28px rgba(0,0,0,0.35)",

              transition:
                "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
              minWidth: 0,
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = isSelected
                ? "0 0 0 3px rgba(53,182,255,0.26), 0 18px 34px rgba(0,0,0,0.40)"
                : "0 18px 34px rgba(0,0,0,0.40)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "none";
              (e.currentTarget as HTMLDivElement).style.boxShadow = isSelected
                ? "0 0 0 3px rgba(53,182,255,0.22), 0 14px 28px rgba(0,0,0,0.35)"
                : "0 14px 28px rgba(0,0,0,0.35)";
            }}
          >
            {/* 상단 광택(shine) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 42,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 100%)",
                pointerEvents: "none",
              }}
            />

            {/* 안쪽 프레임(인셋) */}
            <div
              style={{
                position: "absolute",
                inset: 6,
                borderRadius: 10,
                border: `1px solid ${innerBorder}`,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                pointerEvents: "none",
              }}
            />

            {/* 선택 상태 코너 장식 */}
            {isSelected && (
              <>
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 10,
                    height: 10,
                    borderTop: "2px solid rgba(53,182,255,0.9)",
                    borderLeft: "2px solid rgba(53,182,255,0.9)",
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 10,
                    height: 10,
                    borderTop: "2px solid rgba(53,182,255,0.9)",
                    borderRight: "2px solid rgba(53,182,255,0.9)",
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                />
              </>
            )}

            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                paddingTop: 2,
              }}
            >
              {/* 썸네일: 프레임+광택 */}
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)",
                  border: isSelected
                    ? "1px solid rgba(53,182,255,0.55)"
                    : "1px solid rgba(255,255,255,0.10)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,0,0,0.35), 0 10px 18px rgba(0,0,0,0.35)",
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
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      objectFit: "cover",
                      background: "#111",
                      border: "1px solid rgba(0,0,0,0.35)",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 32, color: "rgba(255,255,255,0.40)" }}>
                    🪖
                  </span>
                )}
              </div>

              {/* 타이틀: 게임 UI 느낌(글로우) */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                  color: "rgba(255,255,255,0.94)",
                  fontFamily: "Pretendard, Malgun Gothic, sans-serif",
                  textShadow: isSelected
                    ? "0 0 10px rgba(53,182,255,0.35), 0 2px 0 rgba(0,0,0,0.55)"
                    : "0 2px 0 rgba(0,0,0,0.55)",
                }}
              >
                {head.order}번
              </div>

              {/* 좌표: 전부 표시(줄바꿈 OK), 다만 폭을 넘어가면 2줄 이상으로 자연스럽게 */}
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: "16px",
                  padding: "0 8px",
                  color: "rgba(255,255,255,0.72)",
                  wordBreak: "break-word",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                }}
              >
                {coordText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}