// app/components/wiki/NpcGrid.tsx
import React from "react";
import { toProxyUrl } from "@lib/cdn";

const ALLOWED_TAGS = [
  "추천",
  "필수",
  "완정",
  "보스",
  "타임어택",
  "기사단",
  "극난퀘",
  "혼의 시련",
  "6차",
] as const;
type TagKey = (typeof ALLOWED_TAGS)[number];

export type Npc = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
  tag?: string | null; // 한국어 태그 그대로
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
};

const isImageUrl = (v?: string | null) =>
  typeof v === "string" && v.startsWith("http");
const slug = (t: string) => t.replace(/\s+/g, "-");

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

        const tag = (ALLOWED_TAGS as readonly string[]).includes(
          (npc.tag ?? "") as string
        )
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
            }}  // ← 여기 괄호 두 개만 닫히면 OK!
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid #ddd",
              borderRadius: 12,
              height: 110,
              cursor: "pointer",
              background: selected ? "#e7f6ff" : "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              position: "relative",
              outline: "none",
              overflow: "hidden",
            }}
          >
            {/* ✅ 우상단 태그 뱃지 */}
            {tag && (
              <span className={`npc-tag-badge tag-${slug(tag)}`} aria-hidden>
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

            {/* styled-jsx: 뱃지 스타일 */}
            <style jsx>{`
              .npc-tag-badge {
                position: absolute;
                right: 6px;
                top: 6px;
                font-size: 12px;
                font-weight: 800;
                padding: 4px 8px;
                border-radius: 8px;
                line-height: 1;
                color: var(--tag-fg, #ffffff);
                background: var(--tag-bg, #111827);
                box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95),
                  0 1.5px 0 rgba(0, 0, 0, 0.25);
                pointer-events: none;
              }
              .npc-tag-badge::after {
                content: "";
                position: absolute;
                right: 12px;
                bottom: -5px;
                width: 14px;
                height: 8px;
                background: var(--tag-bg, #111827);
                border-bottom-left-radius: 8px;
                box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95);
              }

              /* 태그별 색 테마 */
              .tag-완정 {
                --tag-bg: #3b82f6;
              }
              .tag-필수,
              .tag-극난퀘,
              .tag-보스 {
                --tag-bg: #ef4444;
              }
              .tag-추천 {
                --tag-bg: #10b981;
              }
              .tag-타임어택 {
                --tag-bg: #f97316;
              }
              .tag-기사단 {
                --tag-bg: #8b5cf6;
              }
              .tag-혼의-시련,
              .tag-6차 {
                --tag-bg: #0ea5e9;
              }
            `}</style>
          </div>
        );
      })}
    </div>
  );
}
