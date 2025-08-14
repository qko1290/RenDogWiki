// =============================================
// File: components/wiki/HeadGrid.tsx
// =============================================
import React from "react";

/**
 * 머리(Head) 카드 그리드
 * - 7열 그리드로 머리 목록을 미리보기(첫 사진 썸네일 표시)
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
};

export default function HeadGrid({ heads, onClick, selectedHeadId }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 20,
        margin: "20px 0",
      }}
    >
      {heads.map((head) => (
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
          }}
          onClick={() => onClick?.(head)}
        >
          {Array.isArray(head.pictures) && head.pictures.length > 0 ? (
            <img
              src={head.pictures[0]}
              alt={`${head.order}번 머리`}
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
          <div style={{ fontSize: 14, color: "#555" }}>
            ({head.location_x}, {head.location_y}, {head.location_z})
          </div>
        </div>
      ))}
    </div>
  );
}
