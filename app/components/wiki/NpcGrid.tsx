// app/components/wiki/NpcGrid.tsx
import React, { useMemo, useState } from "react";
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
  tag?: string | null;
};

type Props = {
  npcs: Npc[];
  onClick?: (npc: Npc) => void;
  selectedNpcId?: number | null;
  page?: number;
  onPageChange?: (nextPage: number) => void;
  pageSize?: number; // 기본 21 (7x3)
  showPager?: boolean; // 기본 true
};

const DEFAULT_PAGE_SIZE = 7 * 3;

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
              {/* 뱃지: 카드 기준 우상단 ‘걸침’ */}
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
                <div className={`npc-name${npc.name.trim().length >= 5 ? " is-long" : ""}`}>
                  {npc.name}
                </div>
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

      <style jsx>{`
        /* 컨테이너 쿼리용 래퍼 */
        .npc-grid-wrap {
          width: 100%;
          container-type: inline-size;
        }
        .npc-grid {
          container-type: inline-size;
        }

        /* 폴백(컨테이너 단위 미지원 브라우저): vw 기반 */
        .npc-grid {
          --icon: clamp(50px, 4vw, 80px); /* 기본 아이콘 기준값 */
          --gap-x: clamp(18px, 3vw, 56px);
          --name: clamp(16px, 1.4vw, 24px);
          --pad: clamp(6px, 0.8vw, 8px);
          --badge-out: 34%;

          display: grid;
          grid-template-columns: repeat(7, 1fr);
          justify-content: start;
          column-gap: var(--gap-x);
          row-gap: 40px;
          margin: 20px 0;
        }

        /* 최신 브라우저: 컨테이너 폭 기준(노트북에서 더 잘 줄어들게) */
        @supports (width: 1cqw) {
          .npc-grid {
            --icon: clamp(50px, 8cqw, 80px);
            --gap-x: clamp(18px, 3cqw, 48px);
            --name: clamp(16px, 2.5cqw, 24px);
            --pad: clamp(6px, 0.8cqw, 8px);
          }

          /* 컨테이너가 1100px 이하(노트북)일 때 조금 더 줄이기 */
          @container (max-width: 1100px) {
            .npc-grid {
              --icon: clamp(46px, 7cqw, 72px);
              --name: clamp(14px, 2.1cqw, 22px);
            }
          }

          /* 더 좁아질 때 한 번 더 축소 */
          @container (max-width: 900px) {
            .npc-grid {
              --icon: clamp(42px, 6cqw, 64px);
              --name: clamp(13px, 1.9cqw, 20px);
            }
          }
        }

        .npc-card {
          width: 100%;
          aspect-ratio: 1 / 1;
          position: relative;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          overflow: visible;
          padding: 0;
          isolation: isolate;
        }
        .npc-card.is-selected {
          background: #e7f6ff;
        }

        .npc-card-inner {
          position: absolute;
          inset: var(--pad);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px; /* 살짝 줄여서 세로 공간 확보 */
        }

        .npc-icon-wrap {
          /* 카드 한 변의 일정 비율(약 60%)을 넘지 않게 해서
             컨테이너가 줄어들면 아이콘도 같이 줄어듦 */
          width: min(var(--icon), 60%);
          aspect-ratio: 1 / 1;
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
          text-shadow: 0 1.2px 0 #fff, 1.2px 0 0 #fff, 0 -1.2px 0 #fff,
            -1.2px 0 0 #fff;
          font-family: var(--wiki-round-font, "Jua"), Pretendard,
            "Malgun Gothic", system-ui, sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 90%;
        }

        .npc-name.is-long {
          font-size: calc(var(--name) * 0.82);
          letter-spacing: 0;
        }

        /* 뱃지(깔끔한 칩 스타일) */
        .npc-tag-badge {
          --badge-out: clamp(6px, 0.8cqw, 10px);
          --badge-h: clamp(22px, 2cqw, 28px);
          --badge-px: clamp(8px, 1.2cqw, 12px);
          --r: 999px;
          --elev: 10px;

          --c: #0f172a;
          --fg: color-mix(in oklab, var(--c) 88%, black 0%);
          --bd: color-mix(in oklab, var(--c) 55%, #ffffff);
          --bg: #fff;

          position: absolute;
          top: 0;
          right: 0;
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
          letter-spacing: 0.2px;
          font-size: clamp(12px, 1.2cqw, 14px);
          white-space: nowrap;

          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.06),
            0 6px var(--elev)
              color-mix(in oklab, var(--c) 22%, transparent);

          z-index: 3;
        }

        .tag-추천 {
          --c: #10b981;
        }
        .tag-필수 {
          --c: #ef4444;
        }
        .tag-완정 {
          --c: #3b82f6;
        }
        .tag-타임어택 {
          --c: #f97316;
        }
        .tag-기사단 {
          --c: #8b5cf6;
        }
        .tag-극난퀘,
        .tag-보스 {
          --c: #dc2626;
        }
        .tag-혼의-시련,
        .tag-6차 {
          --c: #0ea5e9;
        }

        .npc-tag-badge.filled {
          --bg: color-mix(in oklab, var(--c) 12%, #ffffff);
          --bd: color-mix(in oklab, var(--c) 60%, #ffffff);
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.06),
            0 6px var(--elev)
              color-mix(in oklab, var(--c) 26%, transparent),
            inset 0 0 0 1px
              color-mix(in oklab, var(--c) 18%, transparent);
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
