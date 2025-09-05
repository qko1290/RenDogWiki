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

  /** 0부터 시작하는 페이지 인덱스(제어 컴포넌트로 쓰려면 사용) */
  page?: number;
  /** 페이지 변경 콜백(제어 컴포넌트로 쓰려면 함께 제공) */
  onPageChange?: (nextPage: number) => void;
  /** 페이지당 아이템 수(기본 21 = 7×3) */
  pageSize?: number;
  /** 하단 페이저 표시 여부(기본 true) */
  showPager?: boolean;
};

const COLS = 7;
const ROWS = 3;
const DEFAULT_PAGE_SIZE = COLS * ROWS; // 21

const isImageUrl = (v?: string | null) =>
  typeof v === "string" && v.startsWith("http");
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
  // 내부 페이지 상태 (제어 props 미지정 시 사용)
  const [innerPage, setInnerPage] = useState(0);
  const curPage = typeof page === "number" ? page : innerPage;

  // 총 페이지
  const pageCount = Math.max(1, Math.ceil(npcs.length / pageSize));

  // 현재 페이지에 해당하는 21개(또는 pageSize) 슬라이스
  const view = useMemo(() => {
    const start = curPage * pageSize;
    return npcs.slice(start, start + pageSize);
  }, [npcs, curPage, pageSize]);

  const goPage = (p: number) => {
    const next = Math.min(Math.max(0, p), pageCount - 1);
    if (typeof page === "number" && onPageChange) {
      onPageChange(next);
    } else {
      setInnerPage(next);
    }
  };

  return (
    <div className="npc-grid-wrap">
      <div role="grid" aria-label="NPC 목록" className="npc-grid">
        {view.map((npc) => {
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
              }}
              className={`npc-card${selected ? " is-selected" : ""}`}
            >
              <div className="npc-icon-wrap">
                {tag && (
                  <span
                    className={`npc-tag-badge tag-${slug(tag)}`}
                    aria-hidden
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
                    className="npc-icon-img"
                  />
                ) : (
                  <span className="npc-emoji">{npc.icon || "🧑"}</span>
                )}
              </div>

              <div className="npc-name">{npc.name}</div>
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
          <span className="npc-pg-text">
            {curPage + 1} / {pageCount}
          </span>
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

      {/* 한 블록으로 통합한 스타일 (styled-jsx 안정성) */}
      <style jsx>{`
        .npc-grid-wrap {
          width: 100%;
        }

        /* ====== 핵심 레이아웃 규칙 ======
           - 반드시 7열 (repeat(7, ...))
           - 왼쪽 정렬(여백은 오른쪽에 남김)
           - 세로는 3줄까지만 표시(21개는 위에서 슬라이스)
         */
        .npc-grid {
          --card-w: 140px;  /* 카드 가로폭(필요시 조정) */
          --gap-x: 20px;    /* 가로 간격 */
          --gap-y: 40px;    /* 세로 간격 */

          display: grid;
          grid-template-columns: repeat(7, var(--card-w)); /* 하드코딩으로 안정화 */
          justify-content: start;   /* 왼쪽 정렬 */
          column-gap: var(--gap-x);
          row-gap: var(--gap-y);
          margin: 20px 0;
        }

        /* 카드: 가로폭 고정, 아이콘도 고정 크기 */
        .npc-card {
          width: var(--card-w);
          height: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #ddd;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          position: relative;
          outline: none;
          overflow: visible; /* 뱃지가 삐져나가도 보이게 */
        }
        .npc-card.is-selected {
          background: #e7f6ff;
        }

        .npc-icon-wrap {
          position: relative; /* 뱃지 기준점 */
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
          text-shadow: 0 1.5px 0 #fff, 1.5px 0 0 #fff, 0 -1.5px 0 0 #fff, -1.5px 0 0 #fff;
          font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
        }

        /* ===== 뱃지 ===== */
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
        .npc-pg-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .npc-pg-text {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
