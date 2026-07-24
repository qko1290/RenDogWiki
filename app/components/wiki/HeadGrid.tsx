"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { toProxyUrl } from "@lib/cdn";

import "../../wiki/css/document-components/head-grid.css";

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
  onClick?: (
    head: Head,
  ) => void;
  selectedHeadId?:
    number | null;
  headIcon?:
    string | null;
  villageName?:
    string | null;
};

type VillageTheme =
  | "slime"
  | "desert"
  | "frost"
  | "under"
  | "seloterain"
  | "atlantis"
  | "cretora"
  | "hell"
  | "finalis"
  | "default";

function normalizeVillageName(
  value?: string | null,
) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /[\s_\-·ㆍ.,()[\]{}]+/g,
      "",
    );
}

function resolveVillageTheme(
  value?: string | null,
): VillageTheme {
  const village =
    normalizeVillageName(value);

  if (!village) {
    return "default";
  }

  if (
    village.includes(
      "슬라임빌리지",
    ) ||
    village === "슬라임"
  ) {
    return "slime";
  }

  if (
    village.includes(
      "데저트빌리지",
    ) ||
    village.includes("데저트") ||
    village.includes("사막")
  ) {
    return "desert";
  }

  if (
    village.includes(
      "프로스트타운",
    ) ||
    village.includes("프로스트") ||
    village.includes("설원")
  ) {
    return "frost";
  }

  if (
    village.includes(
      "언더빌리지",
    ) ||
    village.includes("언더") ||
    village.includes("지하")
  ) {
    return "under";
  }

  if (
    village.includes(
      "셀로테레인",
    ) ||
    village.includes(
      "셀로테라인",
    )
  ) {
    return "seloterain";
  }

  if (
    village.includes(
      "아틀란티스",
    )
  ) {
    return "atlantis";
  }

  if (
    village.includes(
      "크레토라",
    )
  ) {
    return "cretora";
  }

  if (
    village.includes(
      "헬스토니아",
    )
  ) {
    return "hell";
  }

  if (
    village.includes(
      "피날리스",
    ) ||
    village.includes("공허")
  ) {
    return "finalis";
  }

  return "default";
}

function readVillageNameFromPage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  const search =
    new URLSearchParams(
      window.location.search,
    );

  const titleParam =
    search.get("title");

  if (titleParam) {
    return titleParam.replace(
      /_/g,
      " ",
    );
  }

  const titleElement =
    document.querySelector(
      ".wiki-content-title",
    );

  return String(
    titleElement?.textContent ??
      "",
  ).trim();
}

function isImageSource(
  value?: string | null,
) {
  return (
    typeof value ===
      "string" &&
    value.trim().length > 0
  );
}

function HeadCard({
  head,
  selected,
  thumbnail,
  onActivate,
}: {
  head: Head;
  selected: boolean;
  thumbnail:
    string | null;
  onActivate: () => void;
}) {
  const coordinateText =
    [
      head.location_x,
      head.location_y,
      head.location_z,
    ].join(", ");

  return (
    <button
      type="button"
      className={[
        "head-card",
        selected
          ? "is-selected"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={selected}
      aria-label={
        `${head.order}번 머리, 좌표 ${coordinateText}`
      }
      title={
        `${head.order}번 · (${coordinateText})`
      }
      data-selected={
        selected
          ? "true"
          : "false"
      }
      onClick={onActivate}
    >
      <span
        className="head-card__decor"
        aria-hidden
      />

      <span
        className="head-card__icon-wrap"
        aria-hidden
      >
        <span className="head-card__icon-surface">
          {isImageSource(
            thumbnail,
          ) ? (
            <img
              src={toProxyUrl(
                thumbnail!,
              )}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="head-card-img"
            />
          ) : (
            <span className="head-card-emoji">
              ?
            </span>
          )}
        </span>
      </span>

      <span className="head-card__order">
        <strong>
          {head.order}
        </strong>

        <span>
          번
        </span>
      </span>

      <span className="head-card__coordinate">
        <svg
          viewBox="0 0 18 18"
          aria-hidden
          focusable="false"
        >
          <path
            d="M9 15.2s4-4.2 4-7.6a4 4 0 1 0-8 0c0 3.4 4 7.6 4 7.6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="7.5"
            r="1.45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
          />
        </svg>

        <span>
          {coordinateText}
        </span>
      </span>
    </button>
  );
}

export default function HeadGrid({
  heads,
  onClick,
  selectedHeadId,
  headIcon,
  villageName,
}: Props) {
  const [
    detectedVillageName,
    setDetectedVillageName,
  ] = useState(
    villageName ?? "",
  );

  useEffect(() => {
    if (villageName) {
      setDetectedVillageName(
        villageName,
      );
      return;
    }

    setDetectedVillageName(
      readVillageNameFromPage(),
    );
  }, [
    heads,
    villageName,
  ]);

  const villageTheme =
    useMemo(
      () =>
        resolveVillageTheme(
          villageName ??
            detectedVillageName,
        ),
      [
        detectedVillageName,
        villageName,
      ],
    );

  const villageIcon =
    isImageSource(headIcon)
      ? headIcon!.trim()
      : null;

  return (
    <div
      className="head-grid-wrap"
      data-wiki-grid="head"
      data-village-theme={
        villageTheme
      }
      data-village-name={
        villageName ??
        detectedVillageName
      }
    >
      {heads.length > 0 ? (
        <div
          className="head-grid"
          role="grid"
          aria-label="머리찾기 목록"
        >
          {heads.map(
            (head) => {
              const headPicture =
                Array.isArray(
                  head.pictures,
                ) &&
                head.pictures.length >
                  0
                  ? head.pictures[0]
                  : null;

              const thumbnail =
                villageIcon ??
                headPicture;

              return (
                <HeadCard
                  key={head.id}
                  head={head}
                  selected={
                    selectedHeadId ===
                    head.id
                  }
                  thumbnail={
                    thumbnail
                  }
                  onActivate={() =>
                    onClick?.(
                      head,
                    )
                  }
                />
              );
            },
          )}
        </div>
      ) : (
        <div
          className="head-grid-empty"
          role="status"
        >
          <span
            className="head-grid-empty__icon"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              focusable="false"
            >
              <path
                d="M7 5.5h10v13H7v-13Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9.2 10.2h.01M14.8 10.2h.01M9.5 14.2c.8.6 1.6.9 2.5.9s1.7-.3 2.5-.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <span>
            등록된 머리가 없습니다.
          </span>
        </div>
      )}
    </div>
  );
}
