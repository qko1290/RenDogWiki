// app/components/wiki/NpcGrid.tsx  (전체 코드)
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
  pageSize?: number;          // 기본 21 (7x3)
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
              {/* 뱃지: 카드(npc-card) 기준 우상단 ‘걸침’ */}
              {tag && (
                <span className={`npc-tag-badge tag-${slug(tag)}`} aria-hidden>
                  {tag}
                </span>
              )}

              <div className="npc-card-inner">
                <div className="npc-icon-wrap">
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
        .npc-grid-wrap { width: 100%; container-type: inline-size; }

        .npc-grid {
          /* 🔧 조절 포인트 */
          --icon:  clamp(50px, 4cqw, 60px);    /* 아이콘(이미지) 정사각 크기 */
          --gap-x: clamp(18px, 3cqw, 56px);    /* 카드 가로 간격 */
          --name:  clamp(16px, 1.4cqw, 18px);  /* 이름 폰트 크기 */
          --pad:   clamp(6px, 0.8cqw, 10px);   /* 카드 내부 여백(inset) */
          --badge-out: 34%;                    /* 뱃지 걸침 정도(+)이면 바깥으로 더 나감 */

          display: grid;
          grid-template-columns: repeat(7, 1fr);
          justify-content: start;
          column-gap: var(--gap-x);
          row-gap: 40px;                       /* 세로 간격 고정 */
          margin: 20px 0;
        }

        .npc-card {
          width: 100%;
          aspect-ratio: 1 / 1;                 /* 컨테이너 정사각형 */
          position: relative;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          cursor: pointer;
          /* 뱃지가 카드 밖으로 ‘걸치게’ 보이도록 */
          overflow: visible;
          padding: 0;
        }
        .npc-card.is-selected { background: #e7f6ff; }

        .npc-card-inner {
          position: absolute;
          inset: var(--pad);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(6px, 0.9cqw, 10px);
        }

        .npc-icon-wrap {
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
          font-size: calc(var(--icon) * 0.7);
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 90%;
        }

        /* 🏷️ 뱃지: 카드 기준 우상단 + 걸침(transform)
           - top/right 모서리를 기준으로 대각선으로 바깥쪽으로 살짝 이동
           - 걸침 강도는 --badge-out 로 쉽게 조절
        */
        /* ================================
        CLEAN BADGE (flat chip style)
        - 코너 걸침 위치 그대로 유지
        - 유광/진한 그라데이션 제거
        - 얕은 그림자만 사용
        ================================ */

      .npc-card { position: relative; isolation: isolate; }

      /* 기본 토큰(크기/여백) */
      .npc-tag-badge{
        --badge-out: clamp(6px, 0.8cqw, 10px); /* 카드 코너 밖으로 나가는 정도 */
        --badge-h:   clamp(22px, 2cqw, 28px);  /* 뱃지 높이 */
        --badge-px:  clamp(8px, 1.2cqw, 12px); /* 좌우 패딩 */
        --r: 999px;                             /* 알약 반경 */
        --elev: 10px;                           /* 그림자 번짐 기본값 */

        /* 색 토큰(태그별 클래스에서 --c만 덮어씀) */
        --c: #0f172a;                           /* 주 색상 (기본) */
        --fg: color-mix(in oklab, var(--c) 88%, black 0%); /* 글자색 */
        --bd: color-mix(in oklab, var(--c) 55%, #ffffff);  /* 보더 */
        --bg: #fff;                             /* 배경: 완전 솔리드 */

        position: absolute;
        top: 0; right: 0;
        transform: translate(var(--badge-out), calc(var(--badge-out) * -1));

        display: inline-flex;
        align-items: center;
        height: var(--badge-h);
        padding: 0 var(--badge-px);
        border-radius: var(--r);
        border: 1.5px solid var(--bd);
        background: var(--bg);
        color: var(--fg);
        font-weight: 800;
        letter-spacing: .2px;
        font-size: clamp(12px, 1.2cqw, 14px);
        white-space: nowrap;

        /* 아주 얕은 고도감 — 칩이 살짝 떠있는 느낌 */
        box-shadow:
          0 2px 6px rgba(0,0,0,.06),
          0 6px var(--elev) color-mix(in oklab, var(--c) 22%, transparent);

        z-index: 2;
      }

      /* ▶ “엣지”를 더 줄이고 싶으면 아래 한 줄만 남겨도 충분
      .npc-tag-badge{ box-shadow: 0 2px 6px rgba(0,0,0,.06); }
      */

      /* ===========================
        TAG 팔레트: 색상 하나만 지정
        (보더/텍스트/그림자는 위에서 자동 계산)
        =========================== */
      .tag-추천      { --c: #10b981; } /* 그린 */
      .tag-필수      { --c: #ef4444; } /* 레드 */
      .tag-완정      { --c: #3b82f6; } /* 블루 */
      .tag-타임어택  { --c: #f97316; } /* 오렌지 */
      .tag-기사단    { --c: #8b5cf6; } /* 퍼플 */
      .tag-극난퀘,
      .tag-보스      { --c: #dc2626; } /* 강한 레드 */
      .tag-혼의-시련,
      .tag-6차       { --c: #0ea5e9; } /* 스카이블루 */

      /* ===========================
        (옵션) “필드형”으로 살짝 채워진 버전
        — 더 눈에 띄게 하고 싶을 때 .filled 추가
        =========================== */
      .npc-tag-badge.filled{
        --bg: color-mix(in oklab, var(--c) 12%, #ffffff);
        --bd: color-mix(in oklab, var(--c) 60%, #ffffff);
        box-shadow:
          0 2px 6px rgba(0,0,0,.06),
          0 6px var(--elev) color-mix(in oklab, var(--c) 26%, transparent),
          inset 0 0 0 1px color-mix(in oklab, var(--c) 18%, transparent); /* 미세 인셋 */
      }

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
        }
        .npc-pg-btn:disabled { opacity: 0.5; cursor: default; }
        .npc-pg-text { font-size: 16px; }
      `}</style>
    </div>
  );
}
