// app/components/wiki/NpcGrid.tsx
import React, { useEffect, useMemo, useState } from "react";
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

const DESKTOP_PAGE_SIZE = 7 * 3; // 21
const MOBILE_PAGE_SIZE = 3 * 4; // 현재 실제 사용값 12
const MOBILE_QUERY = "(max-width: 768px)";

const isImageUrl = (v?: string | null) =>
  typeof v === "string" && v.startsWith("http");
const slug = (t: string) => t.replace(/\s+/g, "-");

export default function NpcGrid({
  npcs,
  onClick,
  selectedNpcId,
  page,
  onPageChange,
  pageSize,
  showPager = false,
}: Props) {
  const [innerPage, setInnerPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(MOBILE_QUERY);

    const apply = () => {
      setIsMobile(mq.matches);
    };

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  const resolvedPageSize =
    typeof pageSize === "number" && pageSize > 0
      ? pageSize
      : isMobile
      ? MOBILE_PAGE_SIZE
      : DESKTOP_PAGE_SIZE;

  const curPage = typeof page === "number" ? page : innerPage;
  const pageCount = Math.max(1, Math.ceil(npcs.length / resolvedPageSize));

  useEffect(() => {
    if (curPage <= pageCount - 1) return;

    const next = Math.max(0, pageCount - 1);

    if (typeof page === "number" && onPageChange) onPageChange(next);
    else setInnerPage(next);
  }, [curPage, pageCount, page, onPageChange]);

  const view = useMemo(() => {
    const start = curPage * resolvedPageSize;
    return npcs.slice(start, start + resolvedPageSize);
  }, [npcs, curPage, resolvedPageSize]);

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
                      draggable={false}
                      className="npc-icon-img"
                    />
                  ) : (
                    <span className="npc-emoji">{npc.icon || "🧑"}</span>
                  )}
                </div>

                {(() => {
                  const compactLen = npc.name.replace(/\s+/g, "").length;

                  let nameClass = "";
                  if (compactLen >= 9) nameClass = " is-xlong";
                  else if (compactLen >= 7) nameClass = " is-longer";
                  else if (compactLen >= 5) nameClass = " is-long";

                  return <div className={`npc-name${nameClass}`}>{npc.name}</div>;
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {showPager && pageCount > 1 && (
        <div className="npc-pager-wrap">
          <div className="npc-pager" aria-label="NPC 페이지 이동">
            <button
              type="button"
              className="npc-pg-btn"
              onClick={() => goPage(curPage - 1)}
              disabled={curPage <= 0}
              aria-label="이전 페이지"
              title="이전 페이지"
            >
              ‹
            </button>

            <span className="npc-pg-text" aria-live="polite">
              {curPage + 1} / {pageCount}
            </span>

            <button
              type="button"
              className="npc-pg-btn"
              onClick={() => goPage(curPage + 1)}
              disabled={curPage >= pageCount - 1}
              aria-label="다음 페이지"
              title="다음 페이지"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .npc-grid-wrap {
          width: 100%;
          container-type: inline-size;

          --npc-card-bg: var(--surface-elevated);
          --npc-card-border: var(--border);
          --npc-card-shadow: var(--shadow-sm);
          --npc-card-selected-bg: #e7f6ff;
          --npc-card-selected-border: #93c5fd;

          --npc-name-color: #111;
          --npc-name-shadow:
            0 1.2px 0 #fff,
            1.2px 0 0 #fff,
            0 -1.2px 0 #fff,
            -1.2px 0 0 #fff;

          --npc-badge-bg: #fff;

          --npc-pager-fg: #334155;
          --npc-pager-bg: #ffffff;
          --npc-pager-border: #d7dce3;
          --npc-pager-divider: #e5e7eb;
          --npc-pager-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
          --npc-pager-hover-bg: #f8fafc;
          --npc-pager-disabled-fg: #a3aab5;
        }

        :global(:root[data-theme='dark']) .npc-grid-wrap,
        :global(body[data-theme='dark']) .npc-grid-wrap,
        :global(html.dark) .npc-grid-wrap,
        :global(body.dark) .npc-grid-wrap {
          --npc-card-bg: var(--surface-elevated);
          --npc-card-border: var(--border-strong);
          --npc-card-shadow: 0 12px 28px rgba(2, 6, 23, 0.32);
          --npc-card-selected-bg: color-mix(
            in oklab,
            var(--surface-elevated) 82%,
            #38bdf8 18%
          );
          --npc-card-selected-border: color-mix(
            in oklab,
            var(--border-strong) 55%,
            #60a5fa 45%
          );

          --npc-name-color: var(--foreground);
          --npc-name-shadow:
            0 1.2px 0 rgba(2, 6, 23, 0.95),
            1.2px 0 0 rgba(2, 6, 23, 0.95),
            0 -1.2px 0 rgba(2, 6, 23, 0.95),
            -1.2px 0 0 rgba(2, 6, 23, 0.95);

          --npc-badge-bg: var(--surface);

          --npc-pager-fg: var(--foreground);
          --npc-pager-bg: color-mix(
            in oklab,
            var(--surface-elevated) 96%,
            white 4%
          );
          --npc-pager-border: var(--border-strong);
          --npc-pager-divider: color-mix(
            in oklab,
            var(--border-strong) 72%,
            transparent
          );
          --npc-pager-shadow: 0 12px 28px rgba(2, 6, 23, 0.34);
          --npc-pager-hover-bg: color-mix(
            in oklab,
            var(--surface-elevated) 88%,
            white 10%
          );
          --npc-pager-disabled-fg: var(--muted);
        }

        .npc-grid {
          container-type: inline-size;

          --icon: clamp(50px, 4vw, 80px);
          --gap-x: clamp(18px, 3vw, 56px);
          --name: clamp(16px, 1.4vw, 24px);
          --pad: clamp(6px, 0.8vw, 8px);

          display: grid;
          grid-template-columns: repeat(7, 1fr);
          justify-content: start;
          column-gap: var(--gap-x);
          row-gap: 40px;
          margin: 20px 0;
        }

        @supports (width: 1cqw) {
          .npc-grid {
            --icon: clamp(50px, 8cqw, 80px);
            --gap-x: clamp(18px, 3cqw, 48px);
            --name: clamp(16px, 2.5cqw, 24px);
            --pad: clamp(6px, 0.8cqw, 8px);
          }

          @container (max-width: 1100px) {
            .npc-grid {
              --icon: clamp(46px, 7cqw, 72px);
              --name: clamp(14px, 2.1cqw, 22px);
            }
          }

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
          border: 1.5px solid var(--npc-card-border);
          border-radius: 12px;
          background: var(--npc-card-bg);
          box-shadow: var(--npc-card-shadow);
          cursor: pointer;
          overflow: visible;
          padding: 0;
          isolation: isolate;
        }

        .npc-card.is-selected {
          background: var(--npc-card-selected-bg);
          border-color: var(--npc-card-selected-border);
        }

        .npc-card-inner {
          position: absolute;
          inset: var(--pad);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .npc-icon-wrap {
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
          color: var(--npc-name-color);
          letter-spacing: 0.3px;
          text-shadow: var(--npc-name-shadow);
          font-family: var(--wiki-round-font, "Jua"), Pretendard,
            "Malgun Gothic", system-ui, sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 98%;
        }

        .npc-name.is-long {
          font-size: calc(var(--name) * 0.82);
          letter-spacing: 0;
        }

        .npc-name.is-longer {
          font-size: calc(var(--name) * 0.72);
          letter-spacing: -0.2px;
        }

        .npc-name.is-xlong {
          font-size: calc(var(--name) * 0.62);
          letter-spacing: -0.35px;
        }

        .npc-tag-badge {
          --badge-out: clamp(6px, 0.8cqw, 10px);
          --badge-h: clamp(22px, 2cqw, 28px);
          --badge-px: clamp(8px, 1.2cqw, 12px);
          --r: 999px;
          --elev: 10px;

          --c: #0f172a;
          --fg: color-mix(in oklab, var(--c) 88%, black 0%);
          --bd: color-mix(in oklab, var(--c) 55%, #ffffff);
          --bg: var(--npc-badge-bg);

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
            0 6px var(--elev) color-mix(in oklab, var(--c) 22%, transparent);
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
            0 6px var(--elev) color-mix(in oklab, var(--c) 26%, transparent),
            inset 0 0 0 1px color-mix(in oklab, var(--c) 18%, transparent);
        }

        .npc-pager-wrap {
          display: flex;
          justify-content: center;
          margin: 12px 0 0;
        }

        .npc-pager {
          display: inline-grid;
          grid-template-columns: 52px minmax(84px, auto) 52px;
          align-items: center;
          min-height: 42px;
          border-radius: 14px;
          overflow: hidden;
          background: var(--npc-pager-bg);
          border: 1px solid var(--npc-pager-border);
          box-shadow: var(--npc-pager-shadow);
        }

        .npc-pg-btn {
          height: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          appearance: none;
          background: transparent;
          border: none;
          color: var(--npc-pager-fg);
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          transition:
            background 140ms ease,
            color 140ms ease,
            opacity 140ms ease;
        }

        .npc-pg-btn:first-child {
          border-right: 1px solid var(--npc-pager-divider);
        }

        .npc-pg-btn:last-child {
          border-left: 1px solid var(--npc-pager-divider);
        }

        .npc-pg-btn:hover:not(:disabled) {
          background: var(--npc-pager-hover-bg);
        }

        .npc-pg-btn:disabled {
          color: var(--npc-pager-disabled-fg);
          cursor: default;
        }

        .npc-pg-text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 0 18px;
          font-size: 16px;
          font-weight: 800;
          color: var(--npc-pager-fg);
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .npc-grid {
            --icon: 44px;
            --name: 13px;
            --pad: 5px;

            grid-template-columns: repeat(3, minmax(0, 1fr));
            column-gap: 10px;
            row-gap: 12px;

            width: calc(100% - 20px);
            margin: 12px auto 0;
          }

          .npc-card {
            border-radius: 10px;
          }

          .npc-card-inner {
            gap: 3px;
          }

          .npc-icon-wrap {
            width: min(var(--icon), 54%);
          }

          .npc-icon-img {
            border-radius: 8px;
          }

          .npc-name {
            max-width: 94%;
          }

          .npc-tag-badge {
            --badge-out: 4px;
            --badge-h: 22px;
            --badge-px: 8px;
            font-size: 11px;
          }

          .npc-pager-wrap {
            margin-top: 10px;
          }

          .npc-pager {
            grid-template-columns: 46px minmax(72px, auto) 46px;
            min-height: 40px;
            border-radius: 13px;
          }

          .npc-pg-btn {
            font-size: 24px;
          }

          .npc-pg-text {
            padding: 0 14px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}