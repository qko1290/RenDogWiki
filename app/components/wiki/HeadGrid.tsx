// =============================================
// File: app/components/wiki/HeadGrid.tsx
// =============================================
/**
 * 머리찾기(Head) 목록 그리드 컴포넌트
 * - 각 머리찾기 아이템(좌표/번호/이미지 등) 표시
 * - 클릭 시 상세 모달 오픈
 */

import React from "react";

// Head 타입 정의
export type Head = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
  // 필요시 추가 필드
};

type Props = {
  heads: Head[];
  onClick?: (head: Head) => void;
  selectedHeadId?: number | null;
};

export default function HeadGrid({ heads, onClick, selectedHeadId }: Props) {
  // 한 페이지에 보여줄 개수 등은 상위에서 제어(페이징 등)

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
          {/* 사진 썸네일 */}
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
