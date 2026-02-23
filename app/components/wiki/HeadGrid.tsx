// =============================================
// File: components/wiki/HeadGrid.tsx
// =============================================
import React from "react";
import { toProxyUrl } from "@lib/cdn";

/**
 * 머리(Head) 카드 그리드
 * - 7열 그리드로 머리 목록을 미리보기
 * - 기본 썸네일은 마을의 head_icon 사용
 *   - headIcon prop이 없으면 개별 머리 pictures[0] 사용
 *   - 둘 다 없으면 이모지(🪖) 표시
 * - 카드 클릭 시 상위 onClick(head) 호출
 * - 선택된 카드 배경만 하이라이트(선택 상태 표시)
 */

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
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 20,
        margin: "20px 0",
      }}
    >
      {heads.map((head) => {
        // ✅ 우선순위: 마을 head_icon > 개별 머리 사진 > 이모지
        const villageIcon =
          headIcon && headIcon.trim().length > 0 ? headIcon.trim() : null;

        const headPicture =
          Array.isArray(head.pictures) && head.pictures.length > 0
            ? head.pictures[0]
            : null;

        const thumbSrc = villageIcon ?? headPicture;

        // ✅ 좌표 텍스트: 공백 제거해서 폭 절약 + title로 전체 노출
        const coordText = `(${head.location_x},${head.location_y},${head.location_z})`;

        return (
          <div
            key={head.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid #ddd",
              borderRadius: 10,
              height: 110,
              cursor: "pointer",
              background: selectedHeadId === head.id ? "#e7f6ff" : "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              position: "relative",

              // ✅ ellipsis가 제대로 먹으려면 내부 요소들이 줄어들 수 있어야 함
              minWidth: 0,
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
                  width: 45,
                  height: 45,
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
                textAlign: "center",
                color: "#111",
                letterSpacing: 0.5,
                textShadow: `
                  0 1.5px 0 #fff,
                  1.5px 0 0 #fff,
                  0 -1.5px 0 #fff,
                  -1.5px 0 0 #fff
                `,
                fontFamily: "Pretendard, Malgun Gothic, sans-serif",
              }}
            >
              {head.order}번
            </div>

            {/* ✅ 좌표 줄바꿈 방지 + 넘치면 말줄임 + hover 시 전체 표시 */}
            <div
              title={coordText}
              style={{
                fontSize: 12,
                color: "#555",
                lineHeight: "14px",

                // wrap 방지
                whiteSpace: "nowrap",

                // 넘치면 말줄임 처리
                overflow: "hidden",
                textOverflow: "ellipsis",

                // 카드 안에서 살짝 여유
                maxWidth: "92%",

                // 숫자 폭 균일(가독성)
                fontVariantNumeric: "tabular-nums",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
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