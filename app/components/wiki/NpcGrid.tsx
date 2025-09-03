import React from "react";
import { toProxyUrl } from "@lib/cdn";

const ALLOWED_TAGS = [
  "추천","필수","완정","보스","타임어택","기사단","극난퀘","혼의 시련","6차",
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
  tag?: string | null;
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
};

const isImageUrl = (v?: string | null) => typeof v === "string" && v.startsWith("http");
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

        const tag = (ALLOWED_TAGS as readonly string[]).includes((npc.tag ?? "") as string)
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
            className="npc-card"
          >
            <div className="npc-icon-wrap">
              {/* 아이콘 우상단 ‘걸침’ 뱃지 */}
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
                  className="npc-icon-img"
                />
              ) : (
                <span className="npc-emoji">{npc.icon || "🧑"}</span>
              )}
            </div>

            <div className="npc-name">{npc.name}</div>

            <style jsx>{`
              .npc-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 110px;
                border: 1.5px solid #ddd;
                border-radius: 12px;
                background: ${selected ? "#e7f6ff" : "#fff"};
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
                cursor: pointer;
                position: relative;
                outline: none;
                /* ✅ 뱃지가 카드 바깥으로 삐져나가도 보이도록 */
                overflow: visible;
              }

              .npc-icon-wrap {
                position: relative;   /* 뱃지 기준점 */
                width: 65px;
                height: 65px;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .npc-icon-img {
                width: 65px;
                height: 65px;
                border-radius: 10px;
                object-fit: cover;
                background: #fff;
                display: block;
              }

              .npc-emoji {
                font-size: 44px;
                line-height: 1;
              }

              .npc-name {
                font-size: 21px;
                font-weight: 900;
                text-align: center;
                color: #111;
                letter-spacing: 0.5px;
                text-shadow: 0 1.5px 0 #fff, 1.5px 0 0 #fff, 0 -1.5px 0 #fff, -1.5px 0 0 #fff;
                /* ✅ 둥글둥글한 한글 폰트 */
                font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
              }

              /* ===== 뱃지 =====
                 - 아이콘 우상단을 살짝 넘게 위치
                 - 1.5배 크기 (18px)
                 - 흰 배경 / 컬러 테두리 / 동일색 글씨
                 - 알약 모양 (둥글게)
              */
              .npc-tag-badge {
                position: absolute;
                top: -10px;
                right: -10px;
                font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
                font-size: 18px;          /* 12px → 18px */
                font-weight: 800;
                padding: 6px 12px;
                line-height: 1.05;
                white-space: nowrap;
                color: var(--tag-color, #111827);
                background: #fff;
                border: 2.5px solid var(--tag-color, #111827);
                border-radius: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.12);
                pointer-events: none;
                z-index: 2;
              }

              /* 태그별 테마 컬러(글씨/테두리 동일) */
              .tag-완정       { --tag-color: #3b82f6; } /* 파랑 */
              .tag-필수,
              .tag-극난퀘,
              .tag-보스       { --tag-color: #ef4444; } /* 빨강 */
              .tag-추천       { --tag-color: #10b981; } /* 초록 */
              .tag-타임어택   { --tag-color: #f97316; } /* 주황 */
              .tag-기사단     { --tag-color: #8b5cf6; } /* 보라 */
              .tag-혼의-시련,
              .tag-6차        { --tag-color: #0ea5e9; } /* 하늘색 */
            `}</style>
          </div>
        );
      })}
    </div>
  );
}
