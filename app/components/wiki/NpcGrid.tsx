"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { toProxyUrl } from "@lib/cdn";

import "../../wiki/css/document-components/quest-grid.css";

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

type TagKey =
  (typeof ALLOWED_TAGS)[number];

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
  onClick?: (
    npc: Npc,
  ) => void;
  selectedNpcId?:
    number | null;
  page?: number;
  onPageChange?: (
    nextPage: number,
  ) => void;
  pageSize?: number;
  showPager?: boolean;
};

const DESKTOP_PAGE_SIZE =
  7 * 3;

const MOBILE_PAGE_SIZE =
  3 * 4;

const MOBILE_QUERY =
  "(max-width: 768px)";

function isImageUrl(
  value?: string | null,
) {
  return (
    typeof value ===
      "string" &&
    value.startsWith("http")
  );
}

function slug(
  value: string,
) {
  return value.replace(
    /\s+/g,
    "-",
  );
}

function resolveTag(
  value?: string | null,
): TagKey | null {
  const tag =
    String(value ?? "").trim();

  return (
    ALLOWED_TAGS as readonly string[]
  ).includes(tag)
    ? (tag as TagKey)
    : null;
}

function getNameClass(
  name: string,
) {
  const compactLength =
    name.replace(
      /\s+/g,
      "",
    ).length;

  if (compactLength >= 13) {
    return " is-xlong";
  }

  if (compactLength >= 9) {
    return " is-longer";
  }

  if (compactLength >= 6) {
    return " is-long";
  }

  return "";
}

function QuestCard({
  npc,
  selected,
  onActivate,
}: {
  npc: Npc;
  selected: boolean;
  onActivate: () => void;
}) {
  const tag =
    resolveTag(npc.tag);

  const nameClass =
    getNameClass(npc.name);

  const title = [
    npc.name,
    `(${npc.location_x}, ${npc.location_y}, ${npc.location_z})`,
  ].join(" · ");

  return (
    <button
      type="button"
      className={[
        "npc-card",
        selected
          ? "is-selected"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={selected}
      aria-label={npc.name}
      title={title}
      data-selected={
        selected
          ? "true"
          : "false"
      }
      data-has-tag={
        tag
          ? "true"
          : "false"
      }
      onClick={onActivate}
    >
      {tag ? (
        <span
          className={[
            "npc-tag-badge",
            `tag-${slug(tag)}`,
          ].join(" ")}
          data-quest-tag={tag}
          aria-hidden
        >
          {tag}
        </span>
      ) : null}

      <span
        className="npc-card-inner"
        aria-hidden
      >
        <span className="npc-icon-wrap">
          <span className="npc-icon-surface">
            {isImageUrl(
              npc.icon,
            ) ? (
              <img
                src={toProxyUrl(
                  npc.icon,
                )}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className="npc-icon-img"
              />
            ) : (
              <span className="npc-emoji">
                {npc.icon || ""}
              </span>
            )}
          </span>
        </span>

        <span
          className={[
            "npc-name",
            nameClass,
          ].join("")}
        >
          {npc.name}
        </span>

        <span
          className="npc-card-open-indicator"
        >
          <span>상세 보기</span>

          <svg
            viewBox="0 0 18 18"
            focusable="false"
          >
            <path
              d="m7 5 4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}

export default function NpcGrid({
  npcs,
  onClick,
  selectedNpcId,
  page,
  onPageChange,
  pageSize,
  showPager = false,
}: Props) {
  const [
    innerPage,
    setInnerPage,
  ] = useState(0);

  const [
    isMobile,
    setIsMobile,
  ] = useState(false);

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const mediaQuery =
      window.matchMedia(
        MOBILE_QUERY,
      );

    const apply = () => {
      setIsMobile(
        mediaQuery.matches,
      );
    };

    apply();

    if (
      typeof mediaQuery
        .addEventListener ===
      "function"
    ) {
      mediaQuery.addEventListener(
        "change",
        apply,
      );

      return () => {
        mediaQuery.removeEventListener(
          "change",
          apply,
        );
      };
    }

    mediaQuery.addListener(
      apply,
    );

    return () => {
      mediaQuery.removeListener(
        apply,
      );
    };
  }, []);

  const resolvedPageSize =
    typeof page ===
      "number" &&
    typeof pageSize ===
      "number" &&
    pageSize > 0
      ? pageSize
      : typeof pageSize ===
            "number" &&
          pageSize > 0
        ? pageSize
        : isMobile
          ? MOBILE_PAGE_SIZE
          : DESKTOP_PAGE_SIZE;

  const currentPage =
    typeof page ===
    "number"
      ? page
      : innerPage;

  const pageCount =
    Math.max(
      1,
      Math.ceil(
        npcs.length /
          resolvedPageSize,
      ),
    );

  useEffect(() => {
    if (
      currentPage <=
      pageCount - 1
    ) {
      return;
    }

    const nextPage =
      Math.max(
        0,
        pageCount - 1,
      );

    if (
      typeof page ===
        "number" &&
      onPageChange
    ) {
      onPageChange(
        nextPage,
      );
      return;
    }

    setInnerPage(
      nextPage,
    );
  }, [
    currentPage,
    onPageChange,
    page,
    pageCount,
  ]);

  const visibleNpcs =
    useMemo(() => {
      const start =
        currentPage *
        resolvedPageSize;

      return npcs.slice(
        start,
        start +
          resolvedPageSize,
      );
    }, [
      currentPage,
      npcs,
      resolvedPageSize,
    ]);

  const goPage = (
    targetPage: number,
  ) => {
    const nextPage =
      Math.min(
        Math.max(
          0,
          targetPage,
        ),
        pageCount - 1,
      );

    if (
      typeof page ===
        "number" &&
      onPageChange
    ) {
      onPageChange(
        nextPage,
      );
      return;
    }

    setInnerPage(
      nextPage,
    );
  };

  return (
    <div
      className="npc-grid-wrap"
      data-wiki-grid="quest"
    >
      {visibleNpcs.length >
      0 ? (
        <div
          role="grid"
          aria-label="퀘스트 목록"
          className="npc-grid"
        >
          {visibleNpcs.map(
            (npc) => (
              <QuestCard
                key={npc.id}
                npc={npc}
                selected={
                  selectedNpcId ===
                  npc.id
                }
                onActivate={() =>
                  onClick?.(
                    npc,
                  )
                }
              />
            ),
          )}
        </div>
      ) : (
        <div
          className="npc-grid-empty"
          role="status"
        >
          <span
            className="npc-grid-empty__icon"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              focusable="false"
            >
              <path
                d="M7 4.5h10v15H7v-15Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 8h5M9.5 11.5h5M9.5 15h3.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <span>
            등록된 목록이 없습니다.
          </span>
        </div>
      )}

      {showPager &&
      pageCount > 1 ? (
        <div className="npc-pager-wrap">
          <div
            className="npc-pager"
            aria-label="퀘스트 페이지 이동"
          >
            <button
              type="button"
              className="npc-pg-btn"
              onClick={() =>
                goPage(
                  currentPage - 1,
                )
              }
              disabled={
                currentPage <= 0
              }
              aria-label="이전 페이지"
              title="이전 페이지"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                focusable="false"
              >
                <path
                  d="m12.25 5.5-4.5 4.5 4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <span
              className="npc-pg-text"
              aria-live="polite"
            >
              <strong>
                {currentPage +
                  1}
              </strong>

              <span>/</span>

              <span>
                {pageCount}
              </span>
            </span>

            <button
              type="button"
              className="npc-pg-btn"
              onClick={() =>
                goPage(
                  currentPage + 1,
                )
              }
              disabled={
                currentPage >=
                pageCount - 1
              }
              aria-label="다음 페이지"
              title="다음 페이지"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                focusable="false"
              >
                <path
                  d="m7.75 5.5 4.5 4.5-4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
