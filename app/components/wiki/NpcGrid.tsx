// =============================================
// File: C:\next\rdwiki\app\components\wiki\NpcGrid.tsx
// =============================================
/**
 * NPC 카드 그리드
 * - 7열 x 3행 그리드에 NPC 아이콘/이름 출력
 * - 카드 클릭 시 onClick(npc) 호출, 선택 항목은 하이라이트
 * - 키보드 접근성(Enter/Space) 및 알림 속성 추가
 */

import React from "react";

export type Npc = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
};

const isImageUrl = (v?: string | null) => typeof v === "string" && v.startsWith("http");

export default function NpcGrid({ npcs, onClick, selectedNpcId }: Props) {
  return (
    <div
      role="grid"
      aria-label="NPC 목록"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 20,
        margin: "20px 0",
      }}
    >
      {npcs.map((npc) => {
        const selected = selectedNpcId === npc.id;
        const handleActivate = () => onClick?.(npc);

        return (
          <div
            key={npc.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${npc.name}`}
            title={`${npc.name} · (${npc.location_x}, ${npc.location_y}, ${npc.location_z})`}
            onClick={handleActivate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid #ddd",
              borderRadius: 10,
              height: 110,
              cursor: "pointer",
              background: selected ? "#e7f6ff" : "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              position: "relative",
              outline: "none",
            }}
          >
            {isImageUrl(npc.icon) ? (
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
        );
      })}
    </div>
  );
}
