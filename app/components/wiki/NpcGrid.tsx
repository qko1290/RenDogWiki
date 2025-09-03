// =============================================
// File: app/components/wiki/NpcGrid.tsx (전체 코드)
// =============================================
import React from "react";
import { toProxyUrl } from "@lib/cdn";

// 허용 태그(한국어) — 색은 CSS 변수로 빼서 나중에 쉽게 변경
const ALLOWED_TAGS = [
  '추천','필수','완정','보스','타임어택','기사단','극난퀘','혼의 시련','6차',
] as const;
type TagKey = typeof ALLOWED_TAGS[number];

export type Npc = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
  tag?: string | null;     // ✅ API 그대로(한국어 또는 null)
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
};

const isImageUrl = (v?: string | null) => typeof v === "string" && v.startsWith("http");
const slug = (t: string) => t.replace(/\s+/g, '-'); // CSS 변수 키 변환(공백 → 하이픈)

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

        // 표시용: 허용 목록에 있는 태그만 뱃지로 렌더(그 외 값은 뱃지 미표시)
        const tag = (ALLOWED_TAGS as readonly string[]).includes((npc.tag ?? '') as string)
          ? (npc.tag as TagKey)
          : null;

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
              overflow: "hidden",
            }}
          >
            {/* ✅ 우상단 태그 배지 (색은 CSS 변수) */}
            {tag && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: 6,
                  top: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "4px 8px",
                  borderRadius: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                  background: `var(--tag-${slug(tag)}-bg, #111827)`,
                  color: `var(--tag-${slug(tag)}-fg, #ffffff)`,
                }}
              >
                {tag}
              </span>
            )}

            {isImageUrl(npc.icon) ? (
              <img
                src={toProxyUrl(npc.icon)}
                alt={npc.name}
                loading="lazy"
                decoding="async"
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
                textShadow:
                  "0 1.5px 0 #fff, 1.5px 0 0 #fff, 0 -1.5px 0 #fff, -1.5px 0 0 #fff",
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
