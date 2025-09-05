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
  /** 제어형 페이지(0부터). 미지정 시 내부 상태 사용 */
  page?: number;
  onPageChange?: (nextPage: number) => void;
  /** 기본 21(7x3) */
  pageSize?: number;
  /** 페이저 표시 (기본 true) */
  showPager?: boolean;
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
        /* 컨테이너 쿼리 활성화: 내부 치수(가로폭)에 반응하는 cqw 단위 사용 */
        .npc-grid-wrap {
          width: 100%;
          container-type: inline-size;
        }

        /* ===== 레이아웃 =====
           - 항상 7열
           - 컨테이너 폭을 균등 분배(1fr) → 남는 공간 없음
           - 왼쪽 정렬
        */
        .npc-grid {
          /* 기본 값 (필요시 아래 clamp 계수만 미세조정) */
          --gap-x: clamp(10px, 1.2cqw, 24px);  /* 가로 간격: 컨테이너 폭 비례 */
          --gap-y: clamp(16px, 1.8cqw, 36px);  /* 세로 간격 */
          --icon:  clamp(40px, 6.8cqw, 78px);  /* 아이콘 정사각형 한 변 */
          --name:  clamp(14px, 1.6cqw, 20px);  /* 이름 폰트 크기 */

          display: grid;
          grid-template-columns: repeat(7, 1fr); /* 7개 트랙을 항상 유지 */
          justify-content: start;                /* 왼쪽 정렬(트랙은 이미 꽉 찬 상태) */
          column-gap: var(--gap-x);
          row-gap: var(--gap-y);
          margin: 20px 0;
        }

        /* 카드: 트랙 너비를 그대로 사용 → 영역을 꽉 채움 */
        .npc-card {
          width: 100%;
          min-height: calc(var(--icon) + 44px); /* 아이콘 + 이름 영역 여유 */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          cursor: pointer;
          position: relative;
          outline: none;
          overflow: visible;
          padding: clamp(6px, 0.8cqw, 10px);
        }
        .npc-card.is-selected { background: #e7f6ff; }

        /* 아이콘: 정사각형 유지 */
        .npc-icon-wrap {
          position: relative;
          width: var(--icon);
          height: var(--icon);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .npc-icon-img {
          width: var(--icon);
          height: var(--icon);
          border-radius: 10px;
          object-fit: cover;
          background: #fff;
          display: block;
        }
        .npc-emoji {
          font-size: calc(var(--icon) * 0.68);
          line-height: 1;
        }

        .npc-name {
          font-size: var(--name);
          font-weight: 900;
          text-align: center;
          color: #111;
          letter-spacing: 0.3px;
          text-shadow: 0 1.2px 0 #fff, 1.2px 0 0 #fff, 0 -1.2px 0 #fff, -1.2px 0 0 #fff;
          font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
        }

        /* 태그 뱃지(크기도 살짝 스케일) */
        .npc-tag-badge {
          position: absolute;
          top: calc(var(--icon) * -0.32);
          right: calc(var(--icon) * -0.65);
          font-family: var(--wiki-round-font, 'Jua'), Pretendard, Malgun Gothic, sans-serif;
          font-size: clamp(11px, 1.2cqw, 14px);
          font-weight: 800;
          padding: clamp(2px, 0.4cqw, 4px) clamp(6px, 0.8cqw, 8px);
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
