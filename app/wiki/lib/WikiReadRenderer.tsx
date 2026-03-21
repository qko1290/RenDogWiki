// =============================================
// File: app/wiki/lib/WikiReadRenderer.tsx
// (이미지 lazy/async/fetchPriority 적용 + 외부 파비콘 네트워크 호출 제거)
// + CloudFront CDN 치환(cdn) 및 버전 파라미터(withVersion) 적용
// + 문서 렌더러 내부 요소 다크모드 테마 토큰 적용
// =============================================
/**
 * Slate JSON(Descendant[])을 React JSX로 렌더링하는 컴포넌트
 * - heading, info-box, divider, 링크, 이미지, 인라인마크, price-table-card 등 지원
 * - 서버/클라이언트 헤딩 ID 불일치 경고 억제를 위해 heading에 suppressHydrationWarning 사용
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Descendant, Text } from "slate";

// ⬇️ 추가: CDN 치환/버전 유틸 + 최적화 이미지 컴포넌트
import SmartImage from "@/components/common/SmartImage";
import { cdn, withVersion } from "@lib/cdn";
import { extractHeadings } from "@/wiki/lib/extractHeadings";

import type { WikiRefKind } from '@/components/editor/render/types';

import { useRouter } from "next/navigation";

type Props = {
  content: Descendant[];
  readOnly?: boolean;
  onWikiRefClick?: (kind: WikiRefKind, id: number) => void | Promise<void>;
  onWikiNavigate?: (href: string) => void;
};

// ── Element.tsx와 동일한 전역 캐시 (HMR 안전) ─────────────────────
const WIKI_ICON_CACHE_KEY = "__rdwiki_doc_icon_cache__";
const WIKI_DOCS_ALL_KEY = "__rdwiki_docs_all__";
const WIKI_DOC_DETAIL_CACHE_KEY = "__rdwiki_doc_detail_cache__";

const wikiDocIconCache: Map<string, string> =
  (globalThis as any)[WIKI_ICON_CACHE_KEY] ?? new Map<string, string>();
(globalThis as any)[WIKI_ICON_CACHE_KEY] = wikiDocIconCache;

// (현재 이 파일에선 사용 빈도 낮지만, Element.tsx와 포맷을 맞추기 위해 유지)
let wikiDocsAll: any[] | null = (globalThis as any)[WIKI_DOCS_ALL_KEY] ?? null;
const setWikiDocsAll = (rows: any[]) => {
  wikiDocsAll = rows;
  (globalThis as any)[WIKI_DOCS_ALL_KEY] = rows;
};

type WikiDocHeadingMeta = { id: string; icon?: string | null };
type WikiDocDetail = { icon?: string | null; headings: WikiDocHeadingMeta[] };

// 🔹 문서/헤딩 아이콘 캐시 (Element.tsx와 동일한 패턴)
const wikiDocDetailCache: Map<string, WikiDocDetail> =
  (globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] ??
  new Map<string, WikiDocDetail>();

(globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] = wikiDocDetailCache;

// ───────────────────────────────────────────────────────────────

function decodeTitleForDisplay(raw: string | null | undefined) {
  // URL에서 들어온 title: 언더스코어를 공백으로 취급
  const s = String(raw ?? "");
  return s.replace(/_/g, " ").trim();
}

function encodeTitleForShare(raw: string | null | undefined) {
  // 공유(복사용) title: 공백을 언더스코어로
  const s = String(raw ?? "").trim();
  return s.replace(/\s+/g, "_");
}

function decodeTitleFromUrlParam(v: string | null | undefined) {
  return String(v ?? "").replace(/_/g, " ");
}

function encodeTitleForUrlParam(v: string | null | undefined) {
  // " " → "_" (연속 공백도 "_"로)
  return String(v ?? "").trim().replace(/\s+/g, "_");
}

function toHeadingIdFromText(text: string) {
  const cleaned = text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .trim();

  const slug =
    cleaned.toLowerCase().replace(/\s+/g, "-") ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;
  return `heading-${slug}`;
}

/** textAlign → flex justify-content 매핑 */
function flexJustifyFromAlign(
  align?: string | null
): "flex-start" | "center" | "flex-end" {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

/** heading 링크 복사용 컨텍스트 */
type HeadingCopyCtx = {
  copiedHeadingId: string | null;
  onCopyHeading: (id?: string) => void;
  headingOccRef: React.MutableRefObject<Map<string, number>>;
};

/** 읽기 전용 렌더러에서 위키 참조 클릭을 상위로 전달하기 위한 핸들러 */
type WikiRefHandlers = {
  readOnly?: boolean;
  onWikiRefClick?: (kind: any, id: number) => void;
};

/** 외부 링크용 인라인 아이콘 (파비콘 네트워크 호출 제거) */
const ExternalLinkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
  >
    <path
      d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"
      fill="currentColor"
    />
  </svg>
);

type HeadingAnchorButtonProps = {
  anchorId: string;
};

const HeadingAnchorButton: React.FC<HeadingAnchorButtonProps> = ({
  anchorId,
}) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const hash = anchorId ? `#${anchorId}` : "";

    const url =
      typeof window !== "undefined"
        ? (() => {
            const u = new URL(window.location.href);

            // ✅ title 공백 → '_' 로 바꿔서 공유
            const t = u.searchParams.get("title");
            if (t) u.searchParams.set("title", encodeTitleForShare(decodeTitleForDisplay(t)));

            const hash = anchorId ? `#${anchorId}` : "";
            // decodeURIComponent 같은 건 하지 말고 URL 객체 기반으로 안전하게 조립
            return `${u.origin}${u.pathname}?${u.searchParams.toString()}${hash}`;
          })()
        : hash;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      if (typeof window !== "undefined" && hash) {
        window.location.hash = hash;
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="wiki-heading-anchor-btn"
      aria-label="이 제목 링크 복사"
    >
      <span
        className={
          "wiki-heading-anchor-pill" +
          (copied ? " wiki-heading-anchor-pill--copied" : "")
        }
      >
        {copied ? "✔" : "🔗"}
      </span>
    </button>
  );
};

function normalizeToAppHref(rawHref: string) {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://dummy.local";
    const u = new URL(rawHref, base);

    // 같은 오리진이면 Next Link가 좋아하는 상대경로로 정규화
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return rawHref;
  } catch {
    return rawHref;
  }
}

function isInternalWikiHref(rawHref: string) {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://dummy.local";
    const u = new URL(rawHref, base);

    const sameOrigin =
      typeof window === "undefined" || u.origin === window.location.origin;

    // 기존 코드는 pathname === '/wiki' 만 봤는데,
    // 혹시 /wiki/... 같은 형태가 생겨도 안전하게 startsWith로 처리
    return sameOrigin && u.pathname.startsWith("/wiki");
  } catch {
    return false;
  }
}

/** infobox 인라인 스타일 preset */
function getInfoboxPreset(
  boxType: string
): {
  container: React.CSSProperties;
  icon: (React.CSSProperties & Record<string, any>) | null;
  role: "note" | "alert";
  showIcon: boolean;
} {
  const normalize = (t: string) => {
    const v = (t || "info").toLowerCase().trim();

    if (v === "note") return "info";
    if (v === "warn") return "warning";
    if (v === "error") return "danger";
    if (v === "success") return "tip";

    if (v === "white" || v === "하양" || v === "흰색") return "white";
    if (v === "yellow" || v === "노랑" || v === "노란") return "yellow";

    if (
      v === "lime" ||
      v === "green" ||
      v === "lightgreen" ||
      v === "mint" ||
      v === "연두"
    ) {
      return "lime";
    }

    if (v === "pink" || v === "lightpink" || v === "rose" || v === "연분홍") {
      return "pink";
    }

    if (v === "red" || v === "crimson" || v === "빨강" || v === "빨간") {
      return "red";
    }

    return v;
  };

  const baseContainer: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    color: "var(--foreground)",
    boxShadow: "var(--shadow-sm)",
  };

  const map: Record<
    string,
    {
      bg: string;
      bd: string;
      accent: string;
      mask?: string;
      role: "note" | "alert";
      noIcon?: boolean;
    }
  > = {
    info: {
      bg: "rgba(59,130,246,0.12)",
      bd: "rgba(96,165,250,0.28)",
      accent: "#3b82f6",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-info.svg?v=2&token=a463935e93",
      role: "note",
    },
    warning: {
      bg: "rgba(245,158,11,0.12)",
      bd: "rgba(251,191,36,0.30)",
      accent: "#f59e0b",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93",
      role: "note",
    },
    danger: {
      bg: "rgba(239,68,68,0.12)",
      bd: "rgba(248,113,113,0.28)",
      accent: "#ef4444",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/triangle-exclamation.svg?v=2&token=a463935e93",
      role: "alert",
    },
    tip: {
      bg: "rgba(16,185,129,0.12)",
      bd: "rgba(52,211,153,0.28)",
      accent: "#10b981",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93",
      role: "note",
    },

    white: {
      bg: "var(--surface-elevated)",
      bd: "var(--border)",
      accent: "var(--muted-2)",
      role: "note",
      noIcon: true,
    },
    yellow: {
      bg: "rgba(250,204,21,0.14)",
      bd: "rgba(250,204,21,0.32)",
      accent: "#ca8a04",
      role: "note",
      noIcon: true,
    },
    green: {
      bg: "rgba(34,197,94,0.14)",
      bd: "rgba(74,222,128,0.28)",
      accent: "#16a34a",
      role: "note",
      noIcon: true,
    },
    lime: {
      bg: "rgba(34,197,94,0.14)",
      bd: "rgba(74,222,128,0.28)",
      accent: "#16a34a",
      role: "note",
      noIcon: true,
    },
    pink: {
      bg: "rgba(236,72,153,0.12)",
      bd: "rgba(244,114,182,0.28)",
      accent: "#db2777",
      role: "note",
      noIcon: true,
    },
    red: {
      bg: "rgba(239,68,68,0.12)",
      bd: "rgba(248,113,113,0.28)",
      accent: "#dc2626",
      role: "alert",
      noIcon: true,
    },
  };

  const type = normalize(boxType);
  const sel = map[type] ?? map.info;

  const container: React.CSSProperties = {
    ...baseContainer,
    background: sel.bg,
    border: `1px solid ${sel.bd}`,
    ...(sel.noIcon ? { gap: 0 } : null),
  };

  const showIcon = !sel.noIcon && !!sel.mask;

  const icon: (React.CSSProperties & Record<string, any>) | null = showIcon
    ? {
        flex: "0 0 auto",
        width: 18,
        height: 18,
        marginTop: 2,
        backgroundColor: sel.accent,
        WebkitMaskImage: `url(${sel.mask})`,
        maskImage: `url(${sel.mask})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }
    : null;

  return { container, icon, role: sel.role, showIcon };
}

type LinkBlockNode = {
  type: 'link-block';
  url?: string;
  isWiki?: boolean;
  wikiPath?: string | number | null;
  wikiTitle?: string | null;
  sitename?: string | null;
  size?: 'small' | 'half' | 'full';
  docIcon?: string | null;
  children?: Descendant[];
};

// 내부 텍스트 추출 함수 (Element 쪽에서 Node.string 대신 사용하는 버전)
function nodeToPlainText(node: any): string {
  if (!node) return '';
  if (Text.isText(node)) return node.text ?? '';
  if (Array.isArray(node)) return node.map(nodeToPlainText).join('');
  if (Array.isArray(node.children)) return node.children.map(nodeToPlainText).join('');
  return '';
}

type LinkBlockViewProps = {
  node: LinkBlockNode;
  children?: React.ReactNode;
};

const LinkBlockView: React.FC<LinkBlockViewProps> = ({ node, children }) => {
  const el = node;
  const router = useRouter();

  // URL 파싱
  const parsedUrl = React.useMemo(() => {
    if (!el.url) return null;
    try {
      const base =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://dummy.local";
      return new URL(el.url, base);
    } catch {
      return null;
    }
  }, [el.url]);

  // 내부 위키 링크 판별
  const isWikiLink = React.useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    if (typeof window === "undefined") {
      return parsedUrl.pathname.startsWith("/wiki");
    }

    const sameHost = parsedUrl.host === window.location.host;
    return sameHost && parsedUrl.pathname.startsWith("/wiki");
  }, [el.isWiki, parsedUrl]);

  // 표시용 사이트 이름
  let displaySitename = el.sitename ?? "";
  if (!isWikiLink && !displaySitename && parsedUrl) {
    const host = parsedUrl.hostname.replace(/^www\./, "");
    displaySitename = host;
  }

  // 위키 아이콘 상태
  const [wikiIcon, setWikiIcon] = useState<string | null>(
    isWikiLink ? (el.docIcon ?? null) : null
  );

  // 외부 favicon 로딩 실패 폴백
  const [faviconFailed, setFaviconFailed] = useState(false);
  useEffect(() => {
    setFaviconFailed(false);
  }, [el.url, isWikiLink]);

  // ✅ Element.tsx와 동일한 아이콘 결정 로직(기존 유지)
  useEffect(() => {
    if (!isWikiLink || !parsedUrl) return;
    if (typeof window === "undefined") return;

    const urlObj = parsedUrl;

    const urlPathParam = urlObj.searchParams.get("path");
    const pathParam =
      urlPathParam ?? (el.wikiPath != null ? String(el.wikiPath) : null);

    const urlTitleParam = urlObj.searchParams.get("title");
    const titleParamRaw = urlTitleParam ?? el.wikiTitle ?? null;
    const titleParam = titleParamRaw ? decodeTitleForDisplay(titleParamRaw) : null;

    const rawHash = urlObj.hash ? urlObj.hash.slice(1) : "";
    const decodedHash = rawHash
      ? (() => {
          try {
            return decodeURIComponent(rawHash);
          } catch {
            return rawHash;
          }
        })()
      : "";

    const docKeyParts: string[] = [];
    if (pathParam) docKeyParts.push(`p:${pathParam}`);
    if (titleParam) docKeyParts.push(`t:${titleParam}`);
    const baseDocKey = docKeyParts.join("|") || urlObj.pathname;

    const cacheKey = `${baseDocKey}#${decodedHash || "root"}`;

    if (wikiDocIconCache.has(cacheKey)) {
      const cached = wikiDocIconCache.get(cacheKey)!;
      if (cached) setWikiIcon(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let detail = wikiDocDetailCache.get(baseDocKey);

        if (!detail) {
          let res: Response | null = null;

          if (pathParam || titleParam) {
            const qs: string[] = [];
            if (pathParam) qs.push(`path=${encodeURIComponent(pathParam)}`);
            if (titleParam) qs.push(`title=${encodeURIComponent(titleParam)}`);
            const query = qs.join("&");
            res = await fetch(`/api/documents?${query}`, { cache: "force-cache" });
          }

          if (!res || !res.ok) {
            wikiDocIconCache.set(cacheKey, "");
            return;
          }

          const data = await res.json();
          const rawContent = (data as any).content;
          const slateContent =
            typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;

          let headingsMeta: WikiDocHeadingMeta[] = [];
          try {
            const hs = extractHeadings(Array.isArray(slateContent) ? slateContent : []);
            headingsMeta = hs.map((h: any) => ({
              id: String(h.id ?? ""),
              icon: h.icon ?? null,
            }));
          } catch {
            headingsMeta = [];
          }

          detail = {
            icon: ((data as any).icon ?? "").trim() || null,
            headings: headingsMeta,
          };
          wikiDocDetailCache.set(baseDocKey, detail);
        }

        let iconCandidate: string | null = null;
        if (decodedHash && detail.headings.length > 0) {
          const target = decodedHash;
          const normalizedTarget = target.startsWith("heading-") ? target : `heading-${target}`;

          const matched = detail.headings.find((h) => {
            const hid = h.id || "";
            const hidNorm = hid.startsWith("heading-") ? hid : `heading-${hid}`;
            return hid === target || hid === normalizedTarget || hidNorm === target || hidNorm === normalizedTarget;
          });

          if (matched?.icon) iconCandidate = matched.icon || null;
        }

        if (!iconCandidate) iconCandidate = detail.icon || null;

        if (!cancelled) {
          if (iconCandidate) {
            setWikiIcon(iconCandidate);
            wikiDocIconCache.set(cacheKey, iconCandidate);
          } else {
            wikiDocIconCache.set(cacheKey, "");
          }
        }
      } catch {
        if (!cancelled) wikiDocIconCache.set(cacheKey, "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isWikiLink, parsedUrl, el.wikiPath, el.wikiTitle]);

  // ✅ 외부 링크 파비콘
  const externalFavicon: string | null =
    !isWikiLink && parsedUrl ? `${parsedUrl.origin}/favicon.ico` : null;

  const isSmall = el.size === "small" || el.size === "half";
  const wrapperStyle: React.CSSProperties = isSmall
    ? {
        flex: "1 1 calc(50% - 6px)",
        width: "calc(50% - 6px)",
        maxWidth: "calc(50% - 6px)",
        boxSizing: "border-box",
        display: "block",
      }
    : { display: "block", width: "100%", maxWidth: "100%" };

  const labelText =
    nodeToPlainText(node.children) ||
    (isWikiLink
      ? decodeTitleForDisplay(el.wikiTitle) || el.sitename || "문서"
      : displaySitename || el.url || "링크");

  const subText = isWikiLink
    ? "RenDog Wiki"
    : displaySitename || (parsedUrl ? parsedUrl.origin.replace(/^https?:\/\//, "") : "");

  const rawHref = el.url || "#";

  // ✅ same-origin 절대URL도 /wiki?... 형태로 정규화
  const normalizedHref = React.useMemo(() => normalizeToAppHref(rawHref), [rawHref]);

  // --- UI ---
  const [hovered, setHovered] = useState(false);

  const BORDER = hovered
    ? "1.5px solid var(--accent)"
    : "1.5px solid var(--border)";
  const SHADOW = hovered ? "var(--shadow-lg)" : "var(--shadow-sm)";

  const titleFontPx = autoFont(16, labelText, [
    [18, 16],
    [26, 15],
    [34, 14],
    [42, 13],
    [60, 12],
  ]);

  // ✅ 내부 링크는 router.push로 통일(뒤로가기 안정화)
  const handleClick = (e: React.MouseEvent) => {
    if (!isWikiLink) return;

    // 새 탭/특수 클릭은 브라우저 기본 동작 유지
    const any = e as any;
    if (any.metaKey || any.ctrlKey || any.shiftKey || any.altKey) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // ✅ (2) 실제 라우팅은 Next router로
    router.push(normalizedHref);
  };

  return (
    <div
      data-wiki-block="link-block"
      data-wiki-link-kind={isWikiLink ? "internal" : "external"}
      style={{ position: "relative", ...wrapperStyle }}
    >
      {isWikiLink ? (
        // ✅ 내부: <a> 유지 + preventDefault + router.push (히스토리 일관성)
        <a
          href={normalizedHref}
          onClick={handleClick}
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
          }}
          aria-label={labelText}
        >
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              border: BORDER,
              borderRadius: 12,
              marginBottom: 10,
              width: "100%",
              boxSizing: "border-box",
              background: "var(--surface-elevated)",
              boxShadow: SHADOW,
              transition: "box-shadow .14s ease, border-color .14s ease, transform .14s ease",
              transform: hovered ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            {/* 아이콘 영역 */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "var(--accent-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {wikiIcon ? (
                wikiIcon.startsWith("http") ? (
                  <SmartImage
                    src={withVersion(cdn(wikiIcon))}
                    alt="doc icon"
                    width={22}
                    height={22}
                    style={{ width: 22, height: 22, objectFit: "contain", display: "block" }}
                  />
                ) : (
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{wikiIcon}</span>
                )
              ) : (
                <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                  📄
                </span>
              )}
            </div>

            {/* 텍스트 */}
            <div
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div
                style={{
                  fontSize: titleFontPx,
                  fontWeight: 750,
                  color: "var(--foreground)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.1px",
                }}
              >
                {labelText}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={subText}
              >
                {subText}
              </div>
            </div>

            {/* 오른쪽 이동 표시 */}
            <div
              style={{
                flex: "0 0 auto",
                color: hovered ? "var(--accent)" : "var(--muted-2)",
                fontSize: 18,
                fontWeight: 900,
                lineHeight: 1,
                transform: hovered ? "translateX(1px)" : "translateX(0)",
                transition: "transform .14s ease, color .14s ease",
                userSelect: "none",
              }}
              aria-hidden
            >
              →
            </div>
          </div>
        </a>
      ) : (
        // ✅ 외부: 새 탭
        <a
          href={normalizedHref}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
          }}
          aria-label={labelText}
        >
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              border: BORDER,
              borderRadius: 12,
              marginBottom: 10,
              width: "100%",
              boxSizing: "border-box",
              background: "var(--surface-elevated)",
              boxShadow: SHADOW,
              transition: "box-shadow .14s ease, border-color .14s ease, transform .14s ease",
              transform: hovered ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            {/* 아이콘 영역 */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "var(--surface-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {externalFavicon && !faviconFailed ? (
                <img
                  src={externalFavicon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={20}
                  height={20}
                  referrerPolicy="no-referrer"
                  onError={() => setFaviconFailed(true)}
                  style={{
                    width: 20,
                    height: 20,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 4,
                  }}
                />
              ) : (
                <span style={{ fontSize: 18, lineHeight: 1, color: "var(--muted)" }} aria-hidden>
                  🌐
                </span>
              )}
            </div>

            {/* 텍스트 */}
            <div
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div
                style={{
                  fontSize: titleFontPx,
                  fontWeight: 750,
                  color: "var(--foreground)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.1px",
                }}
              >
                {labelText}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={subText}
              >
                {subText}
              </div>
            </div>

            {/* 오른쪽 이동 표시 */}
            <div
              style={{
                flex: "0 0 auto",
                color: hovered ? "var(--accent)" : "var(--muted-2)",
                fontSize: 18,
                fontWeight: 900,
                lineHeight: 1,
                transform: hovered ? "translateX(1px)" : "translateX(0)",
                transition: "transform .14s ease, color .14s ease",
                userSelect: "none",
              }}
              aria-hidden
            >
              →
            </div>
          </div>
        </a>
      )}
    </div>
  );
};

/** 길이에 따라 폰트 자동 축소(대략치) */
function autoFont(base: number, text: string, steps?: Array<[number, number]>) {
  const len = Array.from(text ?? "").length;
  const rules: Array<[number, number]> =
    steps ??
    [
      [8, base],
      [12, base - 2],
      [16, base - 4],
      [22, base - 6],
      [30, base - 8],
      [40, base - 9],
    ];
  for (const [threshold, size] of rules) {
    if (len <= threshold) return size;
  }
  return Math.max(11, (rules.at(-1)?.[1] ?? base) - 2);
}

/** 가격 텍스트: 줄바꿈이 필요할 때만 `~` 뒤가 다음 줄로 떨어지도록 */
function PriceText({ value }: { value: string | number }) {
  const s = String(value ?? "");
  if (!s.includes("~")) return <span className="ptc-price-text">{s}</span>;
  const [left, right] = s.split("~", 2);
  return (
    <span className="ptc-price-text">
      <span style={{ whiteSpace: "nowrap" }}>{left}~</span>
      <wbr />
      <span style={{ whiteSpace: "nowrap" }}>{right}</span>
    </span>
  );
}

// ✅ 강화석 축약 표기 컬러 팔레트: [10강..1강] (php colors.js와 동일)
const RDW_PALETTE = [
  '#5E2569', // 10
  '#B746F8', // 9
  '#F39C12', // 8
  '#E74C3C', // 7
  '#3498DB', // 6
  '#1ABC9C', // 5
  '#309C49', // 4
  '#F1C40F', // 3
  '#DDB89E', // 2
  '#34495E', // 1
] as const;

function colorForLevel(lv: number) {
  if (!Number.isFinite(lv) || lv < 1 || lv > 10) return undefined;
  return RDW_PALETTE[10 - lv];
}

type ColoredChunk = { text: string; color?: string };

function isProbablyCompressedPrice(s: string) {
  // 숫자 / 콜론 / 물결 / 공백만 포함하면 "강화석 표기"로 취급
  return /^[0-9:~\s]+$/.test(s ?? '');
}

/**
 * 렌독 강화석 축약 표기 “표시용 토큰화”
 * - 10:NN... / 10N... / 10NN... 지원
 * - 이후 2자리쌍(lv+ct) 토큰 단위로 색칠
 */
function tokenizeCompressedForColor(input: string): ColoredChunk[] {
  const s0 = String(input ?? '').trim().replace(/\s+/g, '');
  if (!s0) return [{ text: '' }];

  let s = s0;
  const out: ColoredChunk[] = [];

  // Case: '10:NN...' → '10:NN' (10강 색)
  if (s.startsWith('10:')) {
    const rest = s.slice(3);
    if (/^\d+$/.test(rest)) {
      const use2 = rest.length >= 2 && (rest.length - 2) % 2 === 0;
      const take = use2 ? 2 : 1;
      const nPart = rest.slice(0, take);

      out.push({ text: `10:${nPart}`, color: colorForLevel(10) });
      s = rest.slice(take);
    } else {
      return [{ text: s0 }];
    }
  }

  // Case: '10N...' / '10NN...' → '10N' or '10NN' (10강 색)
  if (s.startsWith('10')) {
    const rem = s.length - 2;
    if (rem >= 1) {
      const two = rem >= 2 && rem % 2 === 0;
      const take = two ? 2 : 1;
      const nPart = s.slice(2, 2 + take);

      out.push({ text: `10${nPart}`, color: colorForLevel(10) });
      s = s.slice(2 + take);
    } else {
      out.push({ text: '10', color: colorForLevel(10) });
      s = '';
    }
  }

  // 나머지 2자리쌍: 예) 61 52 ...
  for (let i = 0; i < s.length; ) {
    if (i + 1 >= s.length) {
      out.push({ text: s.slice(i) });
      break;
    }

    const token = s.slice(i, i + 2);
    const lv = parseInt(token[0], 10);

    if (Number.isFinite(lv) && lv >= 1 && lv <= 9) {
      out.push({ text: token, color: colorForLevel(lv) });
    } else {
      out.push({ text: token });
    }

    i += 2;
  }

  return out.length ? out : [{ text: s0 }];
}

function ColoredCompressedText({ value }: { value: string | number }) {
  const raw = String(value ?? '');
  const s = raw.trim();
  if (!s) return <span className="ptc-price-text" />;

  // 범위: 6153~7263
  if (s.includes('~')) {
    const [left, right] = s.split('~', 2);

    const leftChunks = isProbablyCompressedPrice(left)
      ? tokenizeCompressedForColor(left)
      : [{ text: left }];

    const rightChunks = isProbablyCompressedPrice(right)
      ? tokenizeCompressedForColor(right)
      : [{ text: right }];

    return (
      <span className="ptc-price-text">
        <span style={{ whiteSpace: 'nowrap' }}>
          {leftChunks.map((c, i) => (
            <span key={`l-${i}`} style={c.color ? { color: c.color } : undefined}>
              {c.text}
            </span>
          ))}
          <span style={{ color: 'var(--accent)' }}>~</span>
        </span>

        <wbr />

        <span style={{ whiteSpace: 'nowrap' }}>
          {rightChunks.map((c, i) => (
            <span key={`r-${i}`} style={c.color ? { color: c.color } : undefined}>
              {c.text}
            </span>
          ))}
        </span>
      </span>
    );
  }

  // 단일: 6152 / 10183 / 10:129312 ...
  const chunks = isProbablyCompressedPrice(s) ? tokenizeCompressedForColor(s) : [{ text: s }];

  return (
    <span className="ptc-price-text">
      {chunks.map((c, i) => (
        <span key={i} style={c.color ? { color: c.color } : undefined}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

function nameFontSize(name?: string) {
  const n = (name ?? "").trim();
  if (n.length >= 9) return 16;
  if (n.length >= 7) return 18;
  return 20;
}

function wrapNameIfNeeded(name: string) {
  const raw = String(name ?? "");
  const trimmed = raw.trim();

  const len = Array.from(trimmed).length;
  const spaceCount = (trimmed.match(/\s/g) ?? []).length;

  // 조건: 10글자 이상 + 띄어쓰기 2개 이상
  if (!(len >= 10 && spaceCount >= 2)) {
    return { broken: false, parts: [trimmed] as string[] };
  }

  // "7글자 이후"에 등장하는 첫 띄어쓰기 위치를 찾는다
  const chars = Array.from(trimmed);
  let idxAfter7 = -1;

  for (let i = 0; i < chars.length; i++) {
    if (i < 7) continue;
    if (chars[i] === " ") {
      idxAfter7 = i;
      break;
    }
  }

  // 이후 띄어쓰기 못 찾으면 줄바꿈 안 함
  if (idxAfter7 === -1) {
    return { broken: false, parts: [trimmed] as string[] };
  }

  const first = chars.slice(0, idxAfter7).join("").trimEnd();
  const second = chars.slice(idxAfter7 + 1).join("").trimStart();

  // 두 번째가 비면 줄바꿈 의미 없으니 방어
  if (!second) return { broken: false, parts: [trimmed] as string[] };

  return { broken: true, parts: [first, second] as string[] };
}

/** 숫자/문자 폰트 크기를 정규화: 숫자는 px, 단위가 있으면 그대로 */
function normalizeFontSize(v: unknown): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Math.max(1, v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    if (/(px|rem|em|%|vh|vw)$/i.test(s)) return s; // 이미 단위가 있으면 그대로
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`; // 숫자면 px
    return s;
  }
  return undefined;
}

/** "16px" → 16 추출 (px만 파싱) */
function toPxNumber(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const m = /^(-?\d+(?:\.\d+)?)px$/i.exec(v);
  return m ? parseFloat(m[1]) : undefined;
}

/** 손글씨 계열은 기본보다 살짝 크게 보정 */
const HANDWRITING_SCALE: Record<string, number> = {
  BareunHippy: 1.18, // 나눔손글씨 바른히피
  NanumHandwritingMiddleSchool: 1.14, // 나눔손글씨 중학생
};

/** 무기 타입 */
type WeaponType =
  | "epic"
  | "unique"
  | "legendary"
  | "divine"
  | "superior"
  | "class"
  | "block"
  | "hidden"
  | "limited"
  | "ancient"
  | "boss"
  | "miniBoss"
  | "monster"
  | "mini-boss"
  | "rune"
  | "fishing-rod"
  | "transcend-epic"
  | "transcend-unique"
  | "transcend-legend"
  | "transcend-divine"
  | "transcend-superior"
  | 'armor'
  | 'weapon';

// 무기 희귀도(유형)별 메타 정보 (BLOCK/디바인 색상 포함)
const WEAPON_TYPES_META: Record<
  WeaponType,
  { label: string; headerBg: string; border: string; badgeBg: string }
> = {
  epic: {
    label: "EPIC",
    headerBg: "#7c3aed",
    border: "#a855f7",
    badgeBg: "#5b21b6",
  },
  unique: {
    label: "UNIQUE",
    headerBg: "#0ea5e9",
    border: "#38bdf8",
    badgeBg: "#0369a1",
  },
  legendary: {
    label: "LEGEND",
    headerBg: "#f97373",
    border: "#fb7185",
    badgeBg: "#b91c1c",
  },
  // 디바인 조금 더 진하게
  divine: {
    label: "DIVINE",
    headerBg: "#15803d",
    border: "#22c55e",
    badgeBg: "#14532d",
  },
  superior: {
    label: "SUPERIOR",
    headerBg: "#eab308",
    border: "#facc15",
    badgeBg: "#92400e",
  },
  class: {
    label: "CLASS",
    headerBg: "#6366f1",
    border: "#818cf8",
    badgeBg: "#312e81",
  },
  // BLOCK 타입 (연두)
  block: {
    label: "BLOCK",
    headerBg: "#4ade80",
    border: "#a3e635",
    badgeBg: "#166534",
  },
  hidden: {
    label: "HIDDEN",
    headerBg: "#0f766e",
    border: "#14b8a6",
    badgeBg: "#134e4a",
  },
  limited: {
    label: "LIMITED",
    headerBg: "#f97316",
    border: "#fdba74",
    badgeBg: "#c2410c",
  },
  ancient: {
    label: "ANCIENT",
    headerBg: "#6b7280",
    border: "#9ca3af",
    badgeBg: "#374151",
  },
  boss: { label: "BOSS", headerBg: "#6D28D9", border: "#A78BFA", badgeBg: "#4C1D95" },
  miniBoss: { label: "MINI BOSS", headerBg: "#DC2626", border: "#F87171", badgeBg: "#7F1D1D" },
  monster: { label: "MONSTER", headerBg: "#059669", border: "#34D399", badgeBg: "#064E3B" },
  "mini-boss": { label: "MINI BOSS", headerBg: "#DC2626", border: "#F87171", badgeBg: "#7F1D1D" },
  "transcend-epic": {
    label: "TRANSCEND EPIC",
    headerBg: "#7c3aed",
    border: "#a855f7",
    badgeBg: "#5b21b6",
  },
  rune: {
    label: 'RUNE',
    headerBg: '#2e1065',
    border: '#7c3aed',
    badgeBg: '#1e0b3a',
  },
  'fishing-rod': {
    label: 'FISHING ROD',
    headerBg: '#0369a1',
    border: '#38bdf8',
    badgeBg: '#0c4a6e',
  },
  "transcend-unique": {
    label: "TRANSCEND UNIQUE",
    headerBg: "#0ea5e9",
    border: "#38bdf8",
    badgeBg: "#0369a1",
  },
  "transcend-legend": {
    label: "TRANSCEND LEGEND",
    headerBg: "#f97373",
    border: "#fb7185",
    badgeBg: "#b91c1c",
  },
  "transcend-divine": {
    label: "TRANSCEND DIVINE",
    headerBg: "#15803d",
    border: "#22c55e",
    badgeBg: "#14532d",
  },
  "transcend-superior": {
    label: "TRANSCEND SUPERIOR",
    headerBg: "#eab308",
    border: "#facc15",
    badgeBg: "#92400e",
  },
  armor: {
    label: 'ARMOR',
    headerBg: '#0f172a',
    border: '#334155',
    badgeBg: '#111827',
  },
  weapon: {
    label: 'WEAPON',
    headerBg: '#1f2937',
    border: '#6b7280',
    badgeBg: '#111827',
  },
};

// 공격 영상 모달 (문서 보기에서도 사용)
type WeaponVideoModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

function isTranscendLabel(label: string) {
  const up = (label || "").toUpperCase();
  return up.startsWith("TRANSCEND");
}

function hexToRgba(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "").trim();
  const a = Math.max(0, Math.min(1, alpha));
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(255,255,255,${a})`;
}

function WeaponVideoModal({ open, url, onClose }: WeaponVideoModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2100,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, 90vw)",
          maxHeight: "80vh",
          background: "#020617",
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(0,0,0,.75)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #111827",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#e5e7eb",
            fontSize: 14,
          }}
        >
          <span>공격 영상</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid #4b5563",
              padding: "3px 10px",
              background: "#020617",
              color: "#e5e7eb",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>

        {/* 모달 크기에 맞춰 영상이 잘리지 않도록 contain */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
        >
          <video
            src={url}
            controls
            controlsList="nodownload"
            playsInline
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              background: "#000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ✅ 빈 paragraph 판정 (기존 그대로 써도 됨)
function isEmptyParagraphNode(n: any): boolean {
  if (!n || n.type !== "paragraph") return false;
  const plain = nodeToPlainText(n.children).replace(/\u200B/g, "").trim();
  return plain.length === 0;
}

function compactReadContent(nodes: Descendant[]): Descendant[] {
  const out: Descendant[] = [];

  const isImage = (n: any) => n?.type === "image";

  // ✅ link-block 2개(half) 묶기 때문에, 문서에는 link-block-row가 top-level로 존재할 수 있음
  const isLinkish = (n: any) =>
    n?.type === "link-block" || n?.type === "link-block-row";

  const isInfoboxish = (n: any) => n?.type === "info-box";

  for (let i = 0; i < nodes.length; i++) {
    const prev: any = nodes[i - 1];
    const cur: any = nodes[i];
    const next: any = nodes[i + 1];

    // 빈 단락이 아니면 그대로 유지
    if (!isEmptyParagraphNode(cur)) {
      out.push(cur);
      continue;
    }

    // ✅ (1) 사진과 사진 사이의 빈단락 제거
    if (isImage(prev) && isImage(next)) continue;

    // ✅ (2) 링크 블럭(단일/row) 사이의 빈단락 제거
    if (isLinkish(prev) && isLinkish(next)) continue;

    // ✅ (3) 정보 블럭(info-box) 사이의 빈단락 제거
    if (isInfoboxish(prev) && isInfoboxish(next)) continue;

    // 그 외의 빈 단락은 유지 (의도된 줄바꿈 가능성)
    out.push(cur);
  }

  return out;
}

function getCurrentThemeIsDark() {
  if (typeof document === "undefined") return false;

  const html = document.documentElement;
  const body = document.body;

  return (
    html.dataset.theme === "dark" ||
    body?.dataset?.theme === "dark" ||
    html.classList.contains("dark") ||
    body?.classList?.contains("dark")
  );
}

// 메인 렌더 컴포넌트
export default function WikiReadRenderer({ content, readOnly = true, onWikiRefClick }: Props) {
  const [copiedHeadingId, setCopiedHeadingId] = useState<string | null>(null);

  const headingOccRef = useRef<Map<string, number>>(new Map());

  headingOccRef.current = new Map();

  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      setIsDarkMode(mq.matches);
    };

    apply();

    const onChange = () => apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth <= 768);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = () => {
      setIsDarkMode(getCurrentThemeIsDark());
    };

    apply();

    const html = document.documentElement;
    const body = document.body;

    const observer = new MutationObserver(() => {
      apply();
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    if (body) {
      observer.observe(body, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const handlers: WikiRefHandlers = { readOnly, onWikiRefClick };

  const handleCopyHeadingLink = async (headingId?: string) => {
    if (!headingId) return;
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      return;
    }
    try {
      const u = new URL(window.location.href);

      // ✅ title 공백 → '_' 로 바꿔서 공유
      const t = u.searchParams.get("title");
      if (t) u.searchParams.set("title", encodeTitleForShare(decodeTitleForDisplay(t)));

      const url = `${u.origin}${u.pathname}?${u.searchParams.toString()}#${encodeURIComponent(headingId)}`;

      await navigator.clipboard.writeText(url);
      setCopiedHeadingId(headingId);
      // 필요시 외부에서 감지할 수 있도록 이벤트만 발행(선택 사항, 기존 기능에는 영향 없음)
      try {
        window.dispatchEvent(
          new CustomEvent("wiki:heading-link-copied", {
            detail: { id: headingId },
          })
        );
      } catch {
        // noop
      }
      setTimeout(() => {
        setCopiedHeadingId((prev) => (prev === headingId ? null : prev));
      }, 1500);
    } catch (e) {
      console.error("Failed to copy heading link", e);
    }
  };

  const ctx: HeadingCopyCtx = {
    copiedHeadingId,
    onCopyHeading: handleCopyHeadingLink,
    headingOccRef,
  };

  const normalized = compactReadContent(content);

  // ✅ 추가: 최상위에서 link-block(half) 2개씩 묶어서 row로 렌더링
  const rendered: React.ReactNode[] = [];
  const isHalfLinkBlock = (n: any) =>
    n?.type === "link-block" && (n?.size === "small" || n?.size === "half");

  for (let i = 0; i < normalized.length; i++) {
    const node: any = normalized[i];

    // (1) link-block half가 연속 2개면 row로 묶기
    if (isHalfLinkBlock(node) && isHalfLinkBlock(normalized[i + 1] as any)) {
      const a = node;
      const b: any = normalized[i + 1];

      rendered.push(
        <div
          key={`link-block-row-${i}`}
          style={{
            display: "flex",
            gap: 12,
            margin: "8px 0",
            width: "100%",
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          {renderNode(a, i, ctx, handlers, { isMobile, isDarkMode })}
          {renderNode(b, i + 1, ctx, handlers, { isMobile, isDarkMode })}
        </div>
      );

      i += 1; // 2개 처리했으니 한 칸 더 스킵
      continue;
    }

    // (2) 나머지는 기존처럼 단건 렌더
    rendered.push(renderNode(node, i, ctx, handlers, { isMobile, isDarkMode}));
  }

  return <>{rendered}</>;
}

// ✅ PriceTableCard(읽기용)도 에디터와 동일하게 "mode → stages"를 우선 사용
type PriceFormat =
  | 'block'
  | 'cash'
  | 'limited'
  | 'box'
  | 'armor'
  | 'boss'
  | 'monster'
  | 'title'
  | 'costume'
  | 'fishing'
  | 'scroll'
  | 'rune'
  | 'epic'
  | 'unique'
  | 'legendary'
  | 'divine'
  | 'superior'
  | 'transcend epic'
  | 'transcend unique'
  | 'transcend legendary'
  | 'transcend divine'
  | 'transcend superior';

const AWAKEN_FORMATS: PriceFormat[] = ['epic', 'unique', 'legendary', 'divine', 'superior'];
const TRANSCEND_FORMATS: PriceFormat[] = [
  'transcend epic',
  'transcend unique',
  'transcend legendary',
  'transcend divine',
  'transcend superior',
];

function stagesByFormat(fmt?: string): string[] {
  const f = String(fmt ?? '').trim().toLowerCase() as PriceFormat;
  if (TRANSCEND_FORMATS.includes(f)) return ['거가', '거불'];
  if (AWAKEN_FORMATS.includes(f)) return ['봉인', '1각', '2각', '3각', '4각', 'MAX'];
  return ['가격']; // 단일가
}

function smartNameBreakInfo(nameRaw: string | null | undefined) {
  const name = String(nameRaw ?? "");
  const chars = Array.from(name);
  const len = chars.length;
  const spaceCount = chars.reduce((acc, ch) => (ch === " " ? acc + 1 : acc), 0);

  if (len < 10 || spaceCount < 2) {
    return { node: name as React.ReactNode, broke: false };
  }

  // 7글자 이후(= index 7부터) 공백 탐색
  const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === " ");
  if (breakAt === -1) {
    return { node: name as React.ReactNode, broke: false };
  }

  const first = chars.slice(0, breakAt).join("");
  const second = chars.slice(breakAt + 1).join(""); // 공백 제거

  if (!second.trim()) {
    return { node: name as React.ReactNode, broke: false };
  }

  return {
    node: (
      <span>
        {first}
        <br />
        {second}
      </span>
    ),
    broke: true,
  };
}

type PriceValue = string | number;

function coercePriceArray(v: any): PriceValue[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v as PriceValue[];
  return null;
}

/**
 * ✅ "최신 시세" 우선 가격 배열 선택 로직
 * - (1) item.latestPrices / item.pricesLatest / item.prices_latest 같은 "최신" 필드가 있으면 그걸 우선
 * - (2) item.prices (기본 필드)
 * - (3) stage별 map 형태(예: item.priceByStage, item.pricesByStage)가 있으면 stages 순서로 배열화
 * - (4) 단일 price / value가 있으면 모든 stage에 채움
 * - (5) 없으면 0으로 채움
 *
 * 🔥 에디터에서 실제로 쓰는 필드명이 다를 수 있어서, 호환 키들을 넓게 잡아둠.
 * (너 DB/모달 연동하면서 latest 필드명을 하나로 확정했으면 그 키만 남기면 됨)
 */
function resolvePricesForStages(item: any, stages: string[]): PriceValue[] {
  const latest =
    coercePriceArray(item.latestPrices) ??
    coercePriceArray(item.pricesLatest) ??
    coercePriceArray(item.prices_latest) ??
    coercePriceArray(item.dbPrices) ??
    coercePriceArray(item.db_prices);

  if (latest && latest.length) {
    // 길이 보정
    if (latest.length >= stages.length) return latest.slice(0, stages.length);
    return latest.concat(Array(stages.length - latest.length).fill(0));
  }

  const base = coercePriceArray(item.prices);
  if (base && base.length) {
    if (base.length >= stages.length) return base.slice(0, stages.length);
    return base.concat(Array(stages.length - base.length).fill(0));
  }

  const byStage =
    item.priceByStage ??
    item.pricesByStage ??
    item.prices_by_stage ??
    item.price_map ??
    null;

  if (byStage && typeof byStage === "object") {
    return stages.map((st) => {
      const v = byStage[st];
      return v == null || v === "" ? 0 : v;
    });
  }

  const single = item.price ?? item.value ?? item.latestPrice ?? item.priceLatest;
  if (single != null && single !== "") {
    return Array(stages.length).fill(single);
  }

  return Array(stages.length).fill(0);
}

// -------------------- ✅ 라이브(최신) 시세 로딩/캐시 (Read Renderer용) --------------------

function PriceTableCardBlock({
  node,
  keyProp,
}: {
  node: any;
  keyProp: React.Key;
}) {
  const [indexes, setIndexes] = useState<number[]>(() => node.items.map(() => 0));
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const len = Array.isArray(node.items) ? node.items.length : 0;
    setIndexes((prev) => {
      if (prev.length === len) return prev;
      return Array.from({ length: len }, (_, i) => prev[i] ?? 0);
    });
  }, [node.items]);

  const viewItems = useMemo(() => {
    return Array.isArray(node.items) ? node.items : [];
  }, [node.items]);

  const setCardIdx = (cardIdx: number, dir: -1 | 1) => {
    setIndexes((prev) => {
      const copy = [...prev];
      const item = viewItems[cardIdx];
      if (!item) return copy;

      const len =
        Array.isArray(item.stages) && item.stages.length
          ? item.stages.length
          : stagesByFormat(item.mode).length;

      copy[cardIdx] = (copy[cardIdx] + dir + len) % len;
      return copy;
    });
  };

  return (
    <div
      key={keyProp}
      data-wiki-card-wrap="price-table"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 0,
        boxSizing: "border-box",
        padding: "10px 0",
        margin: "10px 0",
        marginLeft: 10,
        position: "relative",
      }}
    >
      <div
        data-wiki-card-row="price-table"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 25,
          flexWrap: "nowrap",
          width: "100%",
          justifyContent: "center",
          margin: "0 auto",
          maxWidth: 1040,
        }}
      >
        {viewItems.map((item: any, idx: number) => {
          const stages: string[] =
            Array.isArray(item.stages) && item.stages.length
              ? item.stages
              : stagesByFormat(item.mode);
          const prices: Array<string | number> = resolvePricesForStages(item, stages);

          const cardIdx = indexes[idx] ?? 0;
          const stage = stages[cardIdx] || "";
          const priceVal = prices[cardIdx] ?? "";
          const badgeColor = getPriceBadgeColor(stage, item.colorType);

          const nameShown = item.name?.trim() ? item.name : "이름 없음";
          const { node: nameNode, broke: nameBroke } = smartNameBreakInfo(nameShown);

          let brokePrefixLen = 0;
          let brokePrefixSpaceCount = 0;

          if (nameBroke) {
            const chars = Array.from(String(nameShown ?? ""));
            const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === " ");

            if (breakAt !== -1) {
              const first = chars.slice(0, breakAt).join("");
              brokePrefixLen = Array.from(first).length;
              brokePrefixSpaceCount = (first.match(/\s/g) ?? []).length;
            }
          }

          let nameFont: number;

          if (nameBroke) {
            const prefixRule = brokePrefixLen >= 8 && brokePrefixSpaceCount >= 1;
            nameFont = prefixRule ? 16 : 17;
          } else {
            nameFont = autoFont(20, String(nameShown), [
              [7, 18],
              [9, 16],
              [12, 14],
              [16, 13],
              [20, 12],
            ]);
          }

          const priceSize = autoFont(20, String(priceVal));

          const image = item.image ? (
            <img
              src={cdn(item.image)}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              style={{
                width: 65,
                height: 65,
                objectFit: "contain",
                borderRadius: 7,
                background: "var(--surface)",
              }}
            />
          ) : (
            <span
              style={{
                width: 54,
                height: 54,
                background: "var(--surface-soft)",
                borderRadius: 7,
                display: "inline-block",
                boxShadow: "inset 0 0 0 1px var(--border)",
              }}
            />
          );

          const badge =
            stages.length > 1 ? (
              <div
                data-wiki-part="price-badge-wrap"
                style={{
                  position: "absolute",
                  top: 5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 3,
                  width: 66,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <span
                  data-wiki-part="price-badge"
                  style={{
                    background: badgeColor,
                    color: stage === "봉인" ? "#fff" : "#222",
                    padding: "4px 0px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 15,
                    width: 66,
                    display: "inline-block",
                    boxShadow: "0 1px 8px #0001",
                    border: "1.5px solid var(--surface-elevated)",
                    textAlign: "center",
                    letterSpacing: "1px",
                    transition: "background .1s",
                  }}
                >
                  {stage}
                </span>
              </div>
            ) : null;

          const showArrows = hovered === idx && stages.length > 1;

          return (
            <div
              key={idx}
              data-wiki-card="price-table"
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 15,
                padding: 8,
                boxShadow: "var(--shadow-lg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                minWidth: 140,
                maxWidth: 140,
                minHeight: 160,
                margin: "0 8px",
              }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            >
              {badge}

              {showArrows && (
                <button
                  data-wiki-part="price-arrow-left"
                  style={{
                    position: "absolute",
                    left: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "var(--surface-elevated)",
                    border: "1.2px solid var(--border)",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    color: "var(--foreground)",
                    boxShadow: "var(--shadow-sm)",
                    zIndex: 2,
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => setCardIdx(idx, -1)}
                >
                  ◀
                </button>
              )}

              {showArrows && (
                <button
                  data-wiki-part="price-arrow-right"
                  style={{
                    position: "absolute",
                    right: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "var(--surface-elevated)",
                    border: "1.2px solid var(--border)",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    color: "var(--foreground)",
                    boxShadow: "var(--shadow-sm)",
                    zIndex: 2,
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => setCardIdx(idx, 1)}
                >
                  ▶
                </button>
              )}

              <div
                data-wiki-part="price-image-wrap"
                style={{
                  marginBottom: 10,
                  marginTop: 34,
                  width: 65,
                  height: 65,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {image}
              </div>

              <div
                data-wiki-part="price-title"
                style={{
                  fontWeight: 700,
                  fontSize: nameFont,
                  lineHeight: 1.12,
                  marginBottom: 0,
                  color: item.name ? "var(--foreground)" : "var(--muted-2)",
                  textAlign: "center",
                  minHeight: 40,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  whiteSpace: "normal",
                }}
              >
                {item.name ? nameNode : <span style={{ color: "var(--muted-2)" }}>이름 없음</span>}
              </div>

              <div
                data-wiki-part="price-row"
                style={{
                  fontWeight: 800,
                  fontSize: priceSize,
                  lineHeight: 1.04,
                  color: "var(--accent)",
                  textAlign: "center",
                  letterSpacing: "1px",
                  marginTop: 3,
                  borderRadius: 8,
                  padding: "2px 10px",
                  minHeight: 28,
                }}
              >
                <ColoredCompressedText value={priceVal} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 뱃지 컬러 함수
function getPriceBadgeColor(stage: string, _type?: string) {
  switch (stage) {
    case "봉인":
      return "#444";
    case "1각":
    case "2각":
    case "3각":
    case "4각":
      return "#48ea6d";
    case "MAX":
      return "#ffe360";
    case "거가":
      return "#43b04b";
    case "거불":
      return "#e44c4c";
    default:
      return "#5cacee";
  }
}

/* ======================= 🔫 무기 카드 (문서 읽기용) ======================= */

function shortLevelLabel(label: string): string {
  const raw = (label ?? "").trim();
  if (!raw) return "?";

  if (raw.toUpperCase() === "MAX") return "M"; // MAX → M

  const numMatch = raw.match(/\d+/);
  if (numMatch) return numMatch[0]; // "1강" → "1", "10강" → "10"

  return raw[0] ?? "?";
}

type WeaponLevelSelectorProps = {
  levelLabels: string[];
  selectedIndex: number | null;
  onChange: (idx: number) => void;
  compact?: boolean;
  overlay?: boolean;
};

/** 카드 오른쪽 바깥에 붙는 강수 선택 버튼 (단색 뱃지 + MAX만 다른 색) */
function WeaponLevelSelector({
  levelLabels,
  selectedIndex,
  onChange,
  compact = false,
  overlay = false,
}: WeaponLevelSelectorProps) {
  const [open, setOpen] = useState(false);

  // ✅ 단계가 0~1개면 버튼 자체를 렌더하지 않음
  if (levelLabels.length <= 1) return null;

  const selectedLabel =
    selectedIndex != null ? levelLabels[selectedIndex] : null;
  const selectedShort = selectedLabel ? shortLevelLabel(selectedLabel) : "-";

  const isMaxLabel = (label: string | null | undefined, short: string) => {
    if (!label && !short) return false;
    const up = (label ?? "").toUpperCase();
    return up.includes("MAX") || up === "M" || short === "M";
  };

  const selectedIsMax = isMaxLabel(selectedLabel, selectedShort);

  const handleSelect = (idx: number) => {
    onChange(idx);
    setOpen(false);
  };

  // ✅ 기존 톤 유지 (색은 거의 그대로)
  const BASE_BG = "rgba(15,23,42,0.96)";
  const BASE_TEXT = "#e5e7eb";
  const BASE_BORDER = "1px solid rgba(148,163,184,0.95)";
  const ACTIVE_BORDER = "1px solid rgba(96,165,250,0.95)";

  const MAX_BG = "#facc15";
  const MAX_TEXT = "#111827";
  const MAX_BORDER = "1px solid #fbbf24";

  // ✅ 하얀 배경에서 또렷하게: 크기/그림자만 업그레이드
  const DOT = compact ? 26 : 30;
  const DOT_FONT = compact ? 12 : 13;
  const TOP_FONT = compact ? 13 : 14;
  const DOT_SHADOW = "0 10px 24px rgba(15,23,42,0.22), 0 2px 6px rgba(15,23,42,0.12)";
  const DOT_SHADOW_ACTIVE = "0 12px 28px rgba(37,99,235,0.18), 0 2px 8px rgba(15,23,42,0.12)";

  return (
    <div
      data-wiki-part="weapon-level-selector"
      style={{
        position: "relative",
        marginLeft: overlay ? 0 : 10,
        alignSelf: "flex-start",
      }}
    >
      {/* 상단 버튼: 선택된 강수 뱃지 + 화살표 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: "none",
          outline: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          background: "transparent",
          color: BASE_TEXT,
          fontSize: TOP_FONT,
          fontWeight: 650,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            width: DOT,
            height: DOT,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: DOT_FONT,
            fontWeight: 800,
            background: selectedIsMax ? MAX_BG : BASE_BG,
            color: selectedIsMax ? MAX_TEXT : BASE_TEXT,
            border: selectedIsMax ? MAX_BORDER : BASE_BORDER,
            boxShadow: DOT_SHADOW,
          }}
        >
          {selectedShort}
        </span>

        <span
          style={{
            fontSize: 12,
            opacity: 0.8,
            transform: open ? "translateY(-1px)" : "translateY(0)",
            transition: "transform 0.12s ease",
            userSelect: "none",
          }}
        >
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* 펼쳐지는 강수 리스트 */}
      <div
        style={{
          position: "absolute",
          top: "100%",
          right: overlay ? 0 : 17,
          marginTop: 8,
          zIndex: 40,
          pointerEvents: open ? "auto" : "none",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 0.16s ease-out, transform 0.16s ease-out",
        }}
      >
        <div
          style={{
            padding: 0,
            borderRadius: 0,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
          }}
        >
          {levelLabels.map((fullLabel, idx) => {
            const short = shortLevelLabel(fullLabel);
            const active = selectedIndex === idx;
            const isMax = isMaxLabel(fullLabel, short);

            const bg = isMax ? MAX_BG : BASE_BG;
            const textColor = isMax ? MAX_TEXT : BASE_TEXT;

            const border = isMax
              ? MAX_BORDER
              : active
              ? ACTIVE_BORDER
              : BASE_BORDER;

            return (
              <button
                key={`${fullLabel}-${idx}`}
                type="button"
                onClick={() => handleSelect(idx)}
                style={{
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  padding: 0,
                  margin: 0,
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: DOT_FONT,
                    fontWeight: active ? 900 : 800,
                    background: bg,
                    color: textColor,
                    border,
                    boxShadow: active ? DOT_SHADOW_ACTIVE : DOT_SHADOW,
                    transform: active ? "translateY(-1px)" : "translateY(0)",
                    transition:
                      "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
                  }}
                >
                  {short}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeaponCardRead({
  node,
  keyProp,
  isDarkMode = false,
  isMobile = false,
}: {
  node: any;
  keyProp: React.Key;
  isDarkMode?: boolean;
  isMobile?: boolean;
}) {
  const stats: any[] = Array.isArray(node.stats) ? node.stats : [];
  const enabledStats = stats.filter((s) => s && s.enabled);

  // 🔹 levels 는 "첫 번째로 levels 가 있는 스탯" 기준
  const baseStatWithLevels = enabledStats.find(
    (s) => Array.isArray(s.levels) && s.levels.length > 0
  );
  const levelLabels: string[] = baseStatWithLevels
    ? baseStatWithLevels.levels
        .map((lv: any) => String(lv.levelLabel ?? "").trim())
        .filter(Boolean)
    : [];
  const hasLevelSelector = levelLabels.length > 1;

  // 기본 선택: MAX 있으면 MAX, 없으면 마지막 단계
  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number | null>(
    () => {
      if (!levelLabels.length) return null;
      const idxMax = levelLabels.findIndex(
        (x) => x.toUpperCase() === "MAX" || x.toUpperCase() === "M"
      );
      return idxMax >= 0 ? idxMax : levelLabels.length - 1;
    }
  );

  const [showVideo, setShowVideo] = useState(false);

  // 🔹 Element 쪽과 같은 메타 사용
  const weaponType: WeaponType = (node.weaponType as WeaponType) || "epic";
  const meta = WEAPON_TYPES_META[weaponType] ?? WEAPON_TYPES_META.epic;

  const isTranscend =
    meta.label.startsWith("TRANSCEND") || weaponType.startsWith("transcend-");

  const transcendFrameStyle: React.CSSProperties = {
    padding: 2,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${meta.headerBg} 0%, ${meta.border} 45%, #ffffff 60%, ${meta.headerBg} 100%)`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.18) inset,
      0 18px 55px rgba(0,0,0,.55),
      0 0 28px rgba(255,255,255,.12),
      0 0 40px ${meta.headerBg}55`,
  };

  const transcendInnerGlowStyle: React.CSSProperties = {
    borderRadius: 18,
    overflow: "hidden",
    background: `radial-gradient(circle at 20% 0%, ${meta.border}22, transparent 55%),
      radial-gradient(circle at 100% 0%, ${meta.headerBg}2a, transparent 60%),
      radial-gradient(circle at 50% 110%, rgba(255,255,255,.08), transparent 50%),
      #020617`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.10) inset`,
    position: "relative",
  };

  const name = (node.name ?? "").trim() || "무기 이름 없음";

  // 공용 버전 파라미터
  const versionBase =
    node.imageUpdatedAt ||
    node.imageVersion ||
    node.videoUpdatedAt ||
    node.videoVersion ||
    node.updatedAt ||
    node.version;

  const rawImage = node.imageUrl || node.image || "";
  const imageSrc = rawImage ? withVersion(cdn(rawImage), versionBase) : "";

  const VIDEOLESS_TYPES: WeaponType[] = [
    "boss",
    "miniBoss",
    "mini-boss",
    "rune",
    "fishing-rod",
    "monster",
    "armor"
  ];
  const supportsVideo = !VIDEOLESS_TYPES.includes(weaponType);

  const rawVideo = supportsVideo ? node.videoUrl || "" : "";
  const videoSrc = rawVideo ? withVersion(cdn(rawVideo), versionBase) : "";

  const getStatDisplay = (stat: any): { value: string; unit?: string } => {
    const unit = stat.unit || "";
    if (
      selectedLevelIndex == null ||
      !Array.isArray(stat.levels) ||
      !stat.levels.length
    ) {
      return { value: String(stat.summary ?? ""), unit };
    }
    const lv = stat.levels[selectedLevelIndex];
    const v =
      lv && lv.value != null && lv.value !== ""
        ? String(lv.value)
        : String(stat.summary ?? "");
    return { value: v, unit };
  };

  const cardWidth = isMobile ? 220 : 260;

  const cardBg = isDarkMode ? "var(--surface-elevated)" : "#020617";
  const cardShadow = isDarkMode
    ? "0 18px 45px rgba(2, 6, 23, 0.46)"
    : "0 18px 45px rgba(0,0,0,.45)";

  const titleBg = isDarkMode
    ? "linear-gradient(180deg, rgba(15,23,42,.98), rgba(17,24,39,.96))"
    : "#020617";
  const titleColor = isDarkMode ? "var(--foreground)" : "#e5e7eb";
  const titleBorder = isDarkMode ? "1px solid var(--border)" : "1px solid #111827";

  const mediaBg = isDarkMode
    ? "radial-gradient(circle at 20% 0%, rgba(56,189,248,0.12), transparent 55%), radial-gradient(circle at 100% 0%, rgba(129,140,248,0.14), transparent 55%), linear-gradient(180deg, rgba(15,23,42,.96), rgba(11,18,32,.98))"
    : "radial-gradient(circle at 20% 0%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 100% 0%, rgba(129,140,248,0.22), transparent 55%), #020617";

  const emptyTextColor = isDarkMode ? "var(--muted-2)" : "#6b7280";
  const statEmptyBg = isDarkMode ? "rgba(15,23,42,.82)" : "rgba(15,23,42,.75)";
  const statRowBorder = isDarkMode ? "1px solid var(--border)" : "1px solid #111827";
  const statRowBg = isDarkMode
    ? "linear-gradient(90deg, rgba(15,23,42,.82), rgba(17,24,39,.96))"
    : "linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))";
  const statLabelColor = isDarkMode ? "var(--muted)" : "#9ca3af";
  const statValueColor = isDarkMode ? "var(--foreground)" : "#e5e7eb";

  const disabledButtonBg = isDarkMode ? "var(--surface)" : "#111827";
  const disabledButtonColor = isDarkMode ? "var(--muted-2)" : "#6b7280";

  return (
    <div key={keyProp} style={{ margin: "14px 0" }}>
      {/* ✅ 카드 + 강수버튼을 "형제"로 두어서 오른쪽에 붙게 함 */}
      <div
        data-wiki-card-wrap="weapon-read"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: isMobile ? 0 : 10,
          flexWrap: "nowrap",
          position: isMobile ? "relative" : undefined,
          width: isMobile ? `${cardWidth}px` : undefined,
          margin: isMobile ? "0 auto" : undefined,
        }}
      >
        {/* 카드 본체 – Element 와 거의 동일한 스타일 */}
        <div style={isTranscend ? transcendFrameStyle : undefined}>
          <div
            data-wiki-card="weapon-read"
            style={{
              width: cardWidth,
              borderRadius: 18,
              overflow: "hidden",
              background: cardBg,
              boxShadow: cardShadow,
              fontFamily: "inherit",
              paddingTop: 8,
              ...(isTranscend ? transcendInnerGlowStyle : null),
            }}
          >
            {/* 상단 타입 바 */}
            <div
              data-wiki-part="weapon-type-bar"
              style={{
                width: "100%",
                background: meta.headerBg,
                color: "#f9fafb",
                padding: isMobile ? "5px 12px" : "10px 12px",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 1.5,
                textAlign: "center",
              }}
            >
              {meta.label}
            </div>

            {/* 무기 이름 */}
            <div
              data-wiki-part="weapon-name"
              style={{
                padding: "10px 14px",
                background: titleBg,
                color: titleColor,
                fontSize: 18,
                fontWeight: 700,
                textAlign: "center",
                borderBottom: titleBorder,
              }}
            >
              {name}
            </div>

            {/* 이미지 영역 */}
            <div
              data-wiki-part="weapon-media"
              style={{
                background: mediaBg,
                height: 140,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {imageSrc ? (
                <SmartImage
                  src={imageSrc}
                  alt={name}
                  width={160}
                  height={96}
                  sizes="(max-width: 768px) 220px, 260px"
                  rounded={10}
                  style={{
                    maxWidth: "80%",
                    maxHeight: "80%",
                    objectFit: "contain",
                    background: "transparent",
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  style={{
                    color: emptyTextColor,
                    fontSize: 14,
                  }}
                >
                  이미지 없음
                </span>
              )}
            </div>

            {/* 스탯 리스트 */}
            <div
              style={{
                padding: "8px 10px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {enabledStats.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: emptyTextColor,
                    padding: "6px 8px",
                    borderRadius: 10,
                    background: statEmptyBg,
                  }}
                >
                  표시할 정보가 없습니다.
                </div>
              )}

              {enabledStats.map((stat) => {
                const { value, unit } = getStatDisplay(stat);
                return (
                  <div
                    data-wiki-part="weapon-stat-row"
                    key={stat.key || stat.label}
                    style={{
                      borderRadius: 10,
                      padding: "6px 8px",
                      border: statRowBorder,
                      background: statRowBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: statLabelColor,
                        fontWeight: 500,
                      }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: statValueColor,
                        fontWeight: 600,
                      }}
                    >
                      {value || "-"}
                      {unit ? ` ${unit}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 하단 공격 영상 버튼 */}
            {supportsVideo && (
              <div
                style={{
                  padding: "8px 10px 10px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button
                  data-wiki-part="weapon-video-button"
                  type="button"
                  disabled={!videoSrc}
                  onClick={() => videoSrc && setShowVideo(true)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    background: videoSrc
                      ? "linear-gradient(90deg,#1d4ed8,#3b82f6)"
                      : disabledButtonBg,
                    color: videoSrc ? "#f9fafb" : disabledButtonColor,
                    cursor: videoSrc ? "pointer" : "default",
                    minWidth: 160,
                    textAlign: "center",
                    boxShadow: videoSrc
                      ? "0 12px 30px rgba(37,99,235,0.7)"
                      : "none",
                  }}
                >
                  스킬 사용 영상
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ✅ 오른쪽 강수 선택 버튼 (카드의 형제) */}
        {levelLabels.length > 1 &&
          (isMobile ? (
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: 8,
                transform: "translateY(-50%)",
                zIndex: 8,
              }}
            >
              <WeaponLevelSelector
                levelLabels={levelLabels}
                selectedIndex={selectedLevelIndex}
                onChange={(idx) => setSelectedLevelIndex(idx)}
                compact
                overlay
              />
            </div>
          ) : (
            <WeaponLevelSelector
              levelLabels={levelLabels}
              selectedIndex={selectedLevelIndex}
              onChange={(idx) => setSelectedLevelIndex(idx)}
            />
          ))}
      </div>

      {/* 영상 모달 */}
      {supportsVideo && videoSrc && (
        <WeaponVideoModal
          open={showVideo}
          url={videoSrc}
          onClose={() => setShowVideo(false)}
        />
      )}
    </div>
  );
}

// 텍스트 노드 처리
function renderLeaf(
  node: any,
  key?: React.Key,
  env?: {
    isMobile?: boolean;
    isDarkMode?: boolean;
    inDarkTableCell?: boolean;
    inTableCell?: boolean;
  }
): React.ReactNode {
  let children = node.text;
  if (node.bold) children = <strong>{children}</strong>;
  if (node.italic) children = <em>{children}</em>;
  if (node.underline) children = <u>{children}</u>;
  if (node.strikethrough) children = <s>{children}</s>;

  const style: React.CSSProperties = {};

  // 색/배경
  if (node.color) style.color = node.color;

  const shouldIgnoreBgInDarkTable =
    env?.isDarkMode && env?.inDarkTableCell;

  if (!shouldIgnoreBgInDarkTable && node.backgroundColor) {
    style.backgroundColor = node.backgroundColor;
  }

  // 🎯 폰트 패밀리 (boolean 방어 + 기본값 적용)
  const rawFamily = node.fontFamily;
  let familyKey: string;
  let familyCss: string;

  if (typeof rawFamily === "string" && rawFamily.trim()) {
    familyKey = rawFamily.trim();
    familyCss = familyKey;
  } else {
    familyKey = "NanumSquareRound";
    familyCss =
      "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  }

  style.fontFamily = familyCss;

  // ✅ 원본 fontSize mark 유무
  const hasCustomFontSize =
    node.fontSize != null &&
    String(node.fontSize).trim() !== "";

  // 폰트 크기 + 손글씨 보정
  const normalized = normalizeFontSize(node.fontSize);
  const basePx = toPxNumber(normalized as any);
  const scale = HANDWRITING_SCALE[familyKey] ?? 1;

  // ✅ 최종 px 값을 따로 보관 (모바일에서 -4px 하기 위함)
  let finalFontPx: number | undefined;

  if (scale !== 1) {
    if (typeof basePx === "number") {
      finalFontPx = Math.round(basePx * scale);
      style.fontSize = `${finalFontPx}px`;
    } else if (normalized !== undefined) {
      style.fontSize = normalized as any;
    } else {
      style.fontSize = `${scale}em`;
    }
    style.lineHeight = style.lineHeight ?? 1.35;
  } else {
    if (normalized !== undefined) {
      style.fontSize = normalized as any;
      if (typeof basePx === "number") {
        finalFontPx = basePx;
      }
    }
  }

  const extraProps: Record<string, any> = {};

  // ✅ 모바일 전용 조정을 위한 표시
  // fontSize가 따로 지정된 텍스트만 data attr 부여
  if (hasCustomFontSize) {
    extraProps["data-wiki-inline-font"] = "custom";

    // px로 환산 가능한 경우에만 CSS 변수로 전달
    if (typeof finalFontPx === "number" && Number.isFinite(finalFontPx)) {
      (style as any)["--wiki-inline-font-px"] = finalFontPx;
    }
  }

  return (
    <span key={key} style={style} {...extraProps}>
      {children}
    </span>
  );
}

function normalizeInfoBoxNodeForMobile(node: any): any {
  if (Text.isText(node)) {
    return {
      ...node,
      text: String(node.text ?? "").replace(/[^\S\r\n]{2,}/g, " "),
    };
  }

  if (node && Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map(normalizeInfoBoxNodeForMobile),
    };
  }

  return node;
}

function renderNode(
  node: any,
  key?: React.Key,
  ctx?: HeadingCopyCtx,
  handlers?: WikiRefHandlers,
  env?: {
    isMobile?: boolean;
    isDarkMode?: boolean;
    inDarkTableCell?: boolean;
    inTableCell?: boolean;
  },
): React.ReactNode {
  if (Text.isText(node)) {
    return renderLeaf(node, key, env);
  }

  const children = node.children?.map((n: any, i: number) =>
    renderNode(n, key ? `${key}-${i}` : i, ctx, handlers, env)
  );

  switch (node.type) {
    case "paragraph": {
      const indentLine = node.indentLine;

      const plainText = stripReact(children).replace(/\u200B/g, "").trim();
      const isEmpty = plainText.length === 0;

      const isMobileTableText = !!env?.isMobile && !!env?.inTableCell;

      const baseFont = isMobileTableText ? 13 : 19;

      const paragraphFontPx = isMobileTableText
        ? 13
        : isEmpty
        ? baseFont
        : autoFont(baseFont, plainText, [
            [40, baseFont],
            [80, baseFont - 1],
            [120, baseFont - 2],
            [170, baseFont - 3],
            [230, baseFont - 4],
            [320, baseFont - 5],
            [450, baseFont - 6],
          ]);

      const style: React.CSSProperties = {
        textAlign: node.textAlign || "left",
        margin: 0,
        lineHeight: env?.inTableCell ? 1.45 : 1.6,
        fontSize: `${paragraphFontPx}px`,
        whiteSpace: "pre-wrap",
        minHeight: isEmpty ? (env?.inTableCell ? "1.45em" : "1.6em") : undefined,
        color: "var(--foreground)",
      };

      if (indentLine) {
        style.borderLeft = "2px solid var(--border-strong)";
        style.paddingLeft = 16;
      }

      return (
        <p
          key={key}
          data-wiki-text="body"
          style={style}
        >
          {children}
        </p>
      );
    }

    case "heading-one":
    case "heading-two":
    case "heading-three": {
      const el = node;

      // 아이콘 처리 (기존 로직 그대로)
      let iconHtml: React.ReactNode = null;
      if (el.icon) {
        if (typeof el.icon === "string" && el.icon.startsWith("http")) {
          iconHtml = (
            <img
              src={cdn(el.icon)}
              alt="icon"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              style={{
                width: "1.7em",
                height: "1.7em",
                verticalAlign: "middle",
                marginRight: 6,
                objectFit: "contain",
                display: "inline-block",
              }}
            />
          );
        } else {
          iconHtml = (
            <span
              style={{
                fontSize: "1.5em",
                fontWeight: 600,
                marginRight: 6,
                display: "inline-block",
              }}
            >
              {el.icon}
            </span>
          );
        }
      }

      // ⬇ fontSize 마크 제거 + 텍스트 추출 (기존 로직 유지)
      const safeChildren = (el.children ?? []).map((child: any, i: number) =>
        renderNode(stripFontSizeFromDescendants(child), key ? `${key}-${i}` : i)
      );

      const textContent = stripReact(safeChildren).trim();
      const baseId = toHeadingIdFromText(textContent);

      // ✅ occ 계산
      const occ = ctx?.headingOccRef.current.get(baseId) ?? 0;
      ctx?.headingOccRef.current.set(baseId, occ + 1);

      // ✅ DOM에 붙을 고유 id
      const domId = `${baseId}--${occ}`;

      const level =
        node.type === "heading-one"
          ? 1
          : node.type === "heading-two"
          ? 2
          : 3;
      const fontSize =
        level === 1 ? "28px" : node.type === "heading-two" ? "22px" : "18px";
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;

      return (
        <Tag
          key={key}
          id={domId}
          suppressHydrationWarning
          data-wiki-text={level === 1 ? "h1" : level === 2 ? "h2" : "h3"}
          style={{
            margin: level === 1 ? "18px 0 10px" : "14px 0 8px",
            fontSize,
            lineHeight: 1.35,
            fontWeight: 800,
            scrollMarginTop: "120px",
            color: "var(--foreground)",
          }}
        >
          {iconHtml}
          {safeChildren}
          <HeadingAnchorButton anchorId={domId} />
        </Tag>
      );
    }

    case "link": {
      const rawHref = String(node.url ?? "");
      const internal = isInternalWikiHref(rawHref);
      const href = normalizeToAppHref(rawHref);

      if (internal) {
        return (
          <a
            key={key}
            href={href}
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            {children}
          </a>
        );
      }

      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          {children}
        </a>
      );
    }

    case "divider": {
      const borderColor = "var(--border-strong)";
      switch (node.style) {
        case "bold":
          return (
            <div
              key={key}
              style={{ width: "95%", margin: "32px auto", textAlign: "center" }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `4px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto",
                }}
              />
            </div>
          );
        case "shortbold":
          return (
            <div
              key={key}
              style={{ width: 82, margin: "34px auto", textAlign: "center" }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `5px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto",
                }}
              />
            </div>
          );
        case "dotted":
          return (
            <div
              key={key}
              style={{ width: "95%", margin: "28px auto", textAlign: "center" }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `2px dotted ${borderColor}`,
                  width: "100%",
                  margin: "0 auto",
                }}
              />
            </div>
          );
        case "diamond":
          return (
            <div
              key={key}
              style={{ width: "100%", margin: "34px 0", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: 24,
                  letterSpacing: 12,
                  color: "var(--muted)",
                }}
              >
                ◇───◇
              </span>
            </div>
          );
        case "diamonddot":
          return (
            <div
              key={key}
              style={{ width: "100%", margin: "32px 0", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: 22,
                  letterSpacing: 6,
                  color: "var(--muted)",
                }}
              >
                ◇ ⋅ ⋅ ⋅ ◇
              </span>
            </div>
          );
        case "dotdot":
          return (
            <div
              key={key}
              style={{ width: "100%", margin: "30px 0", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: 28,
                  letterSpacing: 8,
                  color: borderColor,
                }}
              >
                • • • • • • •
              </span>
            </div>
          );
        case "slash":
          return (
            <div
              key={key}
              style={{ width: "100%", margin: "30px 0", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: 30,
                  letterSpacing: 14,
                  color: borderColor,
                }}
              >
                /  /  /
              </span>
            </div>
          );
        case "bar":
          return (
            <div
              key={key}
              style={{ width: "100%", margin: "28px 0", textAlign: "center" }}
            >
              <span
                style={{
                  fontSize: 22,
                  color: borderColor,
                }}
              >
                |
              </span>
            </div>
          );
        default:
          return (
            <div
              key={key}
              style={{ width: "95%", margin: "24px auto", textAlign: "center" }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `1.5px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto",
                }}
              />
            </div>
          );
      }
    }

    case "link-block": {
      return (
        <LinkBlockView key={key} node={node}>
          {children}
        </LinkBlockView>
      );
    }

    case "link-block-row": {
      return (
        <div
          key={key}
          style={{
            display: "flex",
            gap: 12,
            margin: "8px 0",
            width: "100%",
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          {children}
        </div>
      );
    }

    case "info-box": {
      const raw =
        node.boxType ??
        node.variant ??
        node.tone ??
        node.infoType ??
        "info";

      const type = String(raw).toLowerCase();
      const { container, icon, role, showIcon } = getInfoboxPreset(type);

      const sourceChildren =
        env?.isMobile
          ? (node.children ?? []).map(normalizeInfoBoxNodeForMobile)
          : (node.children ?? []);

      const infoChildren = sourceChildren.map((child: any, i: number) =>
        renderNode(child, key ? `${key}-info-${i}` : i, ctx, handlers, env)
      );

      return (
        <div
          key={key}
          role={role}
          data-wiki-block="info-box"
          style={{ ...container, margin: "8px 0" }}
        >
          {showIcon && icon && (
            <span
              aria-hidden="true"
              data-wiki-part="info-box-icon"
              style={icon as React.CSSProperties}
            />
          )}

          <div
            data-wiki-part="info-box-body"
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              lineHeight: 1.55,
              fontWeight: 560,
              whiteSpace: env?.isMobile ? "pre-line" : "pre-wrap",
            }}
          >
            {infoChildren}
          </div>
        </div>
      );
    }

    // 이미지 블록 (SmartImage로 최적화 + CDN/버전)
    case "image": {
      const justify = flexJustifyFromAlign(node.textAlign);
      const v = (node.updatedAt || node.version) as
        | string
        | number
        | undefined;
      const src = withVersion(cdn(node.url), v);

      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <div key={key} style={{ margin: "16px 0" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: justify,
              alignItems: "flex-start",
              minHeight: 40,
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <SmartImage
                src={src}
                alt=""
                width={w}
                height={h}
                sizes="(max-width: 768px) 90vw, 60vw"
                rounded={10}
                style={{ boxShadow: "0 2px 12px 0 #0001", background: "var(--surface-elevated)" }}
              />
            </div>
          </div>
        </div>
      );
    }

    // 영상 블록: 이미지와 동일한 정렬(textAlign) + CDN/버전 적용
    case "video": {
      const justify = flexJustifyFromAlign(node.textAlign);
      const v = (node.updatedAt || node.version) as
        | string
        | number
        | undefined;
      const src = withVersion(cdn(node.url), v);

      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <div key={key} style={{ margin: "16px 0" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: justify,
              alignItems: "flex-start",
              minHeight: 40,
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <video
                src={src}
                controls
                playsInline
                preload="metadata"
                style={{
                  maxWidth: w ? `${w}px` : "90%",
                  height: h ? `${h}px` : "auto",
                  borderRadius: 10,
                  boxShadow: "0 2px 12px 0 #0001",
                  background: "#000",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    case "inline-image":
      return (
        <img
          key={key}
          src={cdn(node.url)}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{
            height: "1.6em",
            width: "auto",
            display: "inline",
            verticalAlign: "middle",
            margin: "0 2px",
            borderRadius: 4,
          }}
        />
      );

    case "inline-mark":
      return (
        <span
          key={key}
          style={{
            display: "inline-block",
            fontWeight: "bold",
            color: node.color || "var(--muted-2)",
            fontSize: "1.08em",
            marginRight: 8,
            marginLeft: 2,
            userSelect: "none",
            verticalAlign: "middle",
          }}
        >
          {node.icon}
        </span>
      );

    case "price-table-card": {
      if (!Array.isArray(node.items)) return <div key={key}></div>;
      return <PriceTableCardBlock node={node} keyProp={key ?? ""} />;
    }

    // 무기 카드 블록 (문서 보기용)
    case "weapon-card": {
      return (
        <WeaponCardRead
          node={node}
          keyProp={key ?? ""}
          isDarkMode={!!env?.isDarkMode}
          isMobile={!!env?.isMobile}
        />
      );
    }

    case "table": {
      const align = node.align || "left";
      const justify = flexJustifyFromAlign(align);

      const widthPx =
        typeof node.maxWidth === "number" ? node.maxWidth : undefined;
      const tableWidth = widthPx
        ? `${widthPx}px`
        : node.fullWidth
        ? "100%"
        : "auto";

      return (
        <div
          key={key}
          style={{
            margin: "12px 0",
            display: "flex",
            justifyContent: justify,
          }}
        >
          <table
            className="wiki-table"
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
              width: tableWidth,
              maxWidth: "100%",
            }}
          >
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    }

    case "table-row": {
      return <tr key={key}>{children}</tr>;
    }

    case "table-cell": {
      const colSpan = Math.max(1, Number(node.colspan) || 1);
      const rowSpan = Math.max(1, Number(node.rowspan) || 1);

      const customCellBg =
        typeof node.backgroundColor === "string" && node.backgroundColor.trim()
          ? node.backgroundColor
          : typeof node.bgColor === "string" && node.bgColor.trim()
          ? node.bgColor
          : undefined;

      const resolvedCellBg = env?.isDarkMode
        ? "var(--surface-elevated)"
        : customCellBg || "var(--surface-elevated)";

      const cellChildren = node.children?.map((n: any, i: number) =>
        renderNode(
          n,
          key ? `${key}-${i}` : i,
          ctx,
          handlers,
          {
            ...env,
            inDarkTableCell: !!env?.isDarkMode,
            inTableCell: true,
          }
        )
      );

      return (
        <td
          key={key}
          colSpan={colSpan}
          rowSpan={rowSpan}
          style={{
            border: "1px solid var(--border)",
            padding: "6px 8px",
            verticalAlign: "top",
            background: resolvedCellBg,
            color: "var(--foreground)",
          }}
        >
          {cellChildren}
        </td>
      );
    }

    case 'wiki-ref': {
      const el = node as any;
      const kind = (el.kind ?? el.refType) as any;
      const id = Number(el.id ?? el.refId);
      const label = el.label ?? (typeof kind === 'string' ? kind : 'ref');

      const clickable =
        !!handlers?.onWikiRefClick && (handlers?.readOnly ?? true) && Number.isFinite(id) && id > 0;

      const open = () => {
        if (!clickable) return;
        handlers!.onWikiRefClick!(kind, id);
      };

      return (
        <span
          key={key}
          className="wiki-ref-inline"
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          title={Number.isFinite(id) ? `${label} #${id}` : undefined}
          style={{
            color: 'var(--accent)',
            cursor: clickable ? 'pointer' : 'default',
            textDecoration: 'none',
          }}
          onClick={
            clickable
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  open();
                }
              : undefined
          }
          onKeyDown={
            clickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }
                }
              : undefined
          }
        >
          {children}
        </span>
      );
    }

    default:
      return <div key={key}>{children}</div>;
  }
}

// 텍스트 노드에서 fontSize만 제거하면서 자식 전체를 재귀적으로 복제
function stripFontSizeFromDescendants(node: any): any {
  if (Text.isText(node)) {
    const { fontSize, ...rest } = node;
    return rest;
  }
  if (node && Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map(stripFontSizeFromDescendants),
    };
  }
  return node;
}

// React Node의 텍스트만 추출
function stripReact(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(stripReact).join("");
  if (React.isValidElement(node)) return stripReact((node as any).props.children);
  return "";
}