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
    <div role="grid" aria-label="NPC 목록" className="npc-grid">
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
              /* 카드 자체 폭 고정 */
              .npc-card {
                width: var(--card-w);
                height: 110px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: 1.5px solid #ddd;
                border-radius: 12px;
                background: ${selected ? "#e7f6ff" : "#fff"};
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
                cursor: pointer;
                position: relative;
                outline: none;
                overflow: visible;
              }

              .npc-icon-wrap {
                position: relative;
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
                font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
              }

              /* 뱃지 */
              .npc-tag-badge {
                position: absolute;
                top: -20px;
                right: -45px;
                font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
                font-size: 14px;
                font-weight: 800;
                padding: 4px 8px;
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
              .tag-완정       { --tag-color: #3b82f6; }
              .tag-필수,
              .tag-극난퀘,
              .tag-보스       { --tag-color: #ef4444; }
              .tag-추천       { --tag-color: #10b981; }
              .tag-타임어택   { --tag-color: #f97316; }
              .tag-기사단     { --tag-color: #8b5cf6; }
              .tag-혼의-시련,
              .tag-6차        { --tag-color: #0ea5e9; }
            `}</style>
          </div>
        );
      })}

      <style jsx>{`
        /* 그리드: 고정 카드 폭 + 남는 공간을 가로 간격으로 분배 */
        .npc-grid {
          --card-w: 140px;         /* 카드 가로폭(원하는 값으로 조정 가능) */
          display: grid;
          grid-template-columns: repeat(auto-fit, var(--card-w));
          /* 가로 여백을 남는 공간으로 분배 → 화면이 넓어질수록 간격이 자연스럽게 커짐 */
          justify-content: space-evenly;
          /* 세로 간격만 gap으로 관리 (가로는 justify-content로 분배) */
          row-gap: 40px;
          column-gap: 0;
          margin: 20px 0;
        }

        /* 아주 좁은 화면 대비(옵션): 카드 폭 살짝 줄이기 */
        @media (max-width: 380px) {
          .npc-grid { --card-w: 120px; }
        }
      `}</style>
    </div>
  );
}
