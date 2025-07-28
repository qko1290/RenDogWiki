// =============================================
// File: app/components/wiki/NpcGrid.tsx
// =============================================
/**
 * NPC 목록 그리드 컴포넌트
 * - 각 NPC(이름, 아이콘, 위치 등) 표시
 * - 클릭 시 상세 모달 오픈
 */

import React from "react";

// Npc 타입 정의
export type Npc = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
  // 필요시 추가 필드(quest, rewards 등)
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
};

export default function NpcGrid({ npcs, onClick, selectedNpcId }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 20,
        margin: "20px 0",
      }}
    >
      {npcs.map((npc) => (
        <div
          key={npc.id}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid #ddd",
            borderRadius: 10,
            height: 110,
            cursor: "pointer",
            background: selectedNpcId === npc.id ? "#e7f6ff" : "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
            position: "relative",
          }}
          onClick={() => onClick?.(npc)}
        >
          {/* 아이콘 (이미지/이모지) */}
          {npc.icon?.startsWith("http") ? (
            <img
              src={npc.icon}
              alt={npc.name}
              style={{
                width: 65,
                height: 65,
                borderRadius: 10,
                objectFit: "cover",
                background: "#fff",
              }}
            />
          ) : (
            <span style={{ fontSize: 44 }}>{npc.icon || "🧑"}</span>
          )}

          <div
            style={{
              fontSize: 21,
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
            {npc.name}
          </div>
        </div>
      ))}
    </div>
  );
}
