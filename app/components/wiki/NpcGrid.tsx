// app/components/wiki/NpcGrid.tsx
import React, { useMemo, useState } from "react";
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
  page?: number;
  onPageChange?: (nextPage: number) => void;
  pageSize?: number;          // 기본 21(7x3)
  showPager?: boolean;        // 기본 true
};

const DEFAULT_PAGE_SIZE = 7 * 3;

const isImageUrl = (v?: string | null) => typeof v === "string" && v.startsWith("http");
const slug = (t: string) => t.replace(/\s+/g, "-");

export default function NpcGrid({
  npcs,
  onClick,
  selectedNpcId,
  page,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  showPager = true,
}: Props) {
  const [innerPage, setInnerPage] = useState(0);
  const curPage = typeof page === "number" ? page : innerPage;

  const pageCount = Math.max(1, Math.ceil(npcs.length / pageSize));

  const view = useMemo(() => {
    const start = curPage * pageSize;
    return npcs.slice(start, start + pageSize);
  }, [npcs, curPage, pageSize]);

  const goPage = (p: number) => {
    const next = Math.min(Math.max(0, p), pageCount - 1);
    if (typeof page === "number" && onPageChange) onPageChange(next);
    else setInnerPage(next);
  };

  return (
    <div className="npc-grid-wrap">
      <div role="grid" aria-label="NPC 목록" className="npc-grid">
        {view.map((npc) => {
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
              className={`npc-card${selected ? " is-selected" : ""}`}
            >
              {/* 정사각형 카드 내부는 절대 배치 컨테이너로 중앙 정렬 */}
              <div className="npc-card-inner">
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
              </div>
            </div>
          );
        })}
      </div>

      {showPager && pageCount > 1 && (
        <div className="npc-pager" role="navigation" aria-label="NPC 페이지">
          <button
            type="button"
            className="npc-pg-btn"
            onClick={() => goPage(curPage - 1)}
            disabled={curPage === 0}
            aria-label="이전 페이지"
          >
            ◀
          </button>
          <span className="npc-pg-text">{curPage + 1} / {pageCount}</span>
          <button
            type="button"
            className="npc-pg-btn"
            onClick={() => goPage(curPage + 1)}
            disabled={curPage >= pageCount - 1}
            aria-label="다음 페이지"
          >
            ▶
          </button>
        </div>
      )}

      <style jsx>{`
        /* 컨테이너 쿼리: 가로폭에 반응 */
        .npc-grid-wrap { width: 100%; container-type: inline-size; }

        /* ===== 필수 레이아웃 규칙 =====
           - 7열 고정, 왼쪽 정렬
           - 세로 간격 40px 고정
           - 가로 간격은 화면이 넓어질수록 증가
        */
        .npc-grid {
          --icon:  clamp(32px, 4.2cqw, 60px);  /* 아이콘(정사각) 크기 */
          --gap-x: clamp(18px, 2.8cqw, 56px);  /* 가로 간격(가변) */
          --name:  clamp(12px, 1.4cqw, 18px);  /* 이름 글씨 크기 */

          display: grid;
          grid-template-columns: repeat(7, 1fr);
          justify-content: start;
          column-gap: var(--gap-x);
          row-gap: 40px;                       /* 요구사항: 고정 40px */
          margin: 20px 0;
        }

        /* ===== 카드(그리드 아이콘) 자체를 정사각형으로 =====
           - 가로 트랙 너비에 맞춰 세로가 자동으로 같아짐
           - 내부 콘텐츠는 카드 크기에 영향 X (absolute)
        */
        .npc-card {
          width: 100%;
          aspect-ratio: 1 / 1;                 /* ✅ 정사각형 */
          position: relative;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          cursor: pointer;
          overflow: hidden;                     /* 내부가 밖으로 튀어나오지 않게 */
        }
        .npc-card.is-selected { background: #e7f6ff; }

        /* 카드 내부: 중앙 정렬 + 일정 안쪽 여백(inset) */
        .npc-card-inner {
          position: absolute;
          inset: clamp(6px, 0.8cqw, 10px);     /* 카드 안쪽 패딩 느낌 */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(6px, 0.9cqw, 10px);
        }

        /* ==== 아이콘(정사각형 보장) ==== */
        .npc-icon-wrap {
          position: relative;                   /* 뱃지 기준점 */
          width: var(--icon);
          height: var(--icon);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .npc-icon-img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          border-radius: 10px;
          background: #fff;
        }
        .npc-emoji {
          font-size: calc(var(--icon) * 0.68);
          line-height: 1;
          display: block;
        }

        .npc-name {
          font-size: var(--name);
          font-weight: 900;
          text-align: center;
          color: #111;
          letter-spacing: 0.3px;
          text-shadow: 0 1.2px 0 #fff, 1.2px 0 0 #fff, 0 -1.2px 0 #fff, -1.2px 0 0 #fff;
          font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
          /* 이름 길어도 줄바꿈 없이 카드 높이에 영향 없도록 */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 90%;
        }

        /* ==== 뱃지: 아이콘 우상단에 항상 걸치도록 ====
           - 아이콘 크기에 종속(top/right/transform)
           - 아이콘이 커지거나 작아져도 동일한 비율로 위치
        */
        .npc-tag-badge {
          position: absolute;
          top: 0; right: 0;                    /* 아이콘 우상단 모서리 기준 */
          transform: translate(35%, -35%);     /* 살짝 바깥으로 걸침 */
          font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
          font-size: clamp(10px, 1.1cqw, 13px);
          font-weight: 800;
          padding: clamp(2px, 0.35cqw, 4px) clamp(6px, 0.7cqw, 8px);
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

        /* 페이저 */
        .npc-pager {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin: 10px 0 0;
        }
        .npc-pg-btn {
          font-size: 20px;
          background: none;
          border: none;
          cursor: pointer;
          transition: opacity .18s ease;
        }
        .npc-pg-btn:disabled { opacity: 0.5; cursor: default; }
        .npc-pg-text { font-size: 16px; }
      `}</style>
    </div>
  );
}
