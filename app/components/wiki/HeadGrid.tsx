// =============================================
// File: components/wiki/HeadGrid.tsx
// (전체 코드)
// =============================================
"use client";

import React, { useEffect, useState } from "react";
import { toProxyUrl } from "@lib/cdn";

export type Head = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  heads: Head[];
  onClick?: (head: Head) => void;
  selectedHeadId?: number | null;
  headIcon?: string | null;
};

export default function HeadGrid({
  heads,
  onClick,
  selectedHeadId,
  headIcon,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = () => {
      const html = document.documentElement;
      const body = document.body;

      setIsDarkMode(
        html.dataset.theme === "dark" ||
        body?.dataset?.theme === "dark" ||
        html.classList.contains("dark") ||
        body?.classList.contains("dark")
      );
    };

    apply();

    const observer = new MutationObserver(apply);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="head-grid-wrap">
      <div className="head-grid" role="grid" aria-label="머리 목록">
        {heads.map((head) => {
          const hovered = hoveredId === head.id;

          const villageIcon =
            headIcon && headIcon.trim().length > 0 ? headIcon.trim() : null;

          const headPicture =
            Array.isArray(head.pictures) && head.pictures.length > 0
              ? head.pictures[0]
              : null;

          const thumbSrc = villageIcon ?? headPicture;
          const coordText = `(${head.location_x}, ${head.location_y}, ${head.location_z})`;

          const BORDER = hovered
            ? isDarkMode
              ? "1.5px solid rgba(96, 165, 250, 0.95)"
              : "1.5px solid #93c5fd"
            : isDarkMode
              ? "1.5px solid var(--border-strong)"
              : "1.5px solid #d1d5db";

          const SHADOW = hovered
            ? isDarkMode
              ? "0 14px 32px rgba(2, 6, 23, 0.44), 0 0 0 1px rgba(96, 165, 250, 0.18)"
              : "0 12px 28px rgba(2, 132, 199, 0.16), 0 3px 8px rgba(15, 23, 42, 0.08)"
            : isDarkMode
              ? "0 12px 26px rgba(2, 6, 23, 0.34), 0 2px 6px rgba(2, 6, 23, 0.20)"
              : "0 10px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.05)";

          const selected = selectedHeadId === head.id;

          return (
            <div
              key={head.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${head.order}번 머리`}
              className={`head-card${selected ? " is-selected" : ""}`}
              style={{
                border: BORDER,
                boxShadow: SHADOW,
                transform:
                  !isMobile && hovered ? "translateY(-2px)" : "translateY(0)",
              }}
              onMouseEnter={() => setHoveredId(head.id)}
              onMouseLeave={() =>
                setHoveredId((prev) => (prev === head.id ? null : prev))
              }
              onClick={() => onClick?.(head)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.(head);
                }
              }}
            >
              {thumbSrc ? (
                <img
                  src={toProxyUrl(thumbSrc)}
                  alt={`${head.order}번 머리`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="head-card-img"
                />
              ) : (
                <span className="head-card-emoji">🪖</span>
              )}

              <div className="head-card-order">{head.order}번</div>

              <div className="head-card-coord">{coordText}</div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .head-grid-wrap {
          width: 100%;
          container-type: inline-size;

          --head-card-bg: var(--surface-elevated);
          --head-card-selected-bg: #e7f6ff;
          --head-title: #111;
          --head-coord: #555;
          --head-emoji: #bbb;
        }

        :global(:root[data-theme='dark']) .head-grid-wrap,
        :global(body[data-theme='dark']) .head-grid-wrap,
        :global(html.dark) .head-grid-wrap,
        :global(body.dark) .head-grid-wrap {
          --head-card-bg: var(--surface-elevated);
          --head-card-selected-bg: color-mix(in oklab, var(--surface-elevated) 82%, #38bdf8 18%);
          --head-title: var(--foreground);
          --head-coord: var(--muted);
          --head-emoji: var(--muted-2);
        }

        .head-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 20px;
          margin: 20px 0;
        }

        .head-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 125px;
          cursor: pointer;
          background: var(--head-card-bg);
          border-radius: 12px;
          padding: 8px 6px;
          text-align: center;
          transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            border-color 140ms ease,
            background 140ms ease;
        }

        .head-card.is-selected {
          background: var(--head-card-selected-bg);
        }

        .head-card-img {
          width: 46px;
          height: 46px;
          border-radius: 10px;
          object-fit: cover;
          background: var(--surface);
          display: block;
        }

        .head-card-emoji {
          font-size: 38px;
          color: var(--head-emoji);
          line-height: 1;
        }

        .head-card-order {
          font-size: 18px;
          font-weight: 900;
          color: var(--head-title);
          margin-top: 6px;
          font-family: "Pretendard", "Malgun Gothic", sans-serif;
          line-height: 1.1;
        }

        .head-card-coord {
          font-size: 13px;
          color: var(--head-coord);
          margin-top: 4px;
          line-height: 16px;
          word-break: keep-all;
          overflow-wrap: anywhere;
          font-variant-numeric: tabular-nums;
        }

        @media (max-width: 768px) {
          .head-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            column-gap: 10px;
            row-gap: 12px;
            width: calc(100% - 20px);
            margin: 12px auto 0;
          }

          .head-card {
            min-height: 96px;
            border-radius: 10px;
            padding: 6px 4px;
          }

          .head-card-img {
            width: 34px;
            height: 34px;
            border-radius: 8px;
          }

          .head-card-emoji {
            font-size: 28px;
          }

          .head-card-order {
            font-size: 14px;
            margin-top: 4px;
          }

          .head-card-coord {
            font-size: 10px;
            margin-top: 3px;
            line-height: 1.2;
          }
        }
      `}</style>
    </div>
  );
}