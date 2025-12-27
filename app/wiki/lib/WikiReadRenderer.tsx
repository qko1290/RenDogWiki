// =============================================
// File: app/wiki/lib/WikiReadRenderer.tsx
// (이미지 lazy/async/fetchPriority 적용 + 외부 파비콘 네트워크 호출 제거)
// + CloudFront CDN 치환(cdn) 및 버전 파라미터(withVersion) 적용
// =============================================
/**
 * Slate JSON(Descendant[])을 React JSX로 렌더링하는 컴포넌트
 * - heading, info-box, divider, 링크, 이미지, 인라인마크, price-table-card 등 지원
 * - 서버/클라이언트 헤딩 ID 불일치 경고 억제를 위해 heading에 suppressHydrationWarning 사용
 */

import React, { useEffect, useState } from "react";
import { Descendant, Text } from "slate";

// ⬇️ 추가: CDN 치환/버전 유틸 + 최적화 이미지 컴포넌트
import SmartImage from "@/components/common/SmartImage";
import { cdn, withVersion } from "@lib/cdn";
import { extractHeadings } from "@/wiki/lib/extractHeadings";

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
            const { origin, pathname, search } = window.location;
            // 🔽 쿼리스트링을 한글로 디코딩해서 사용
            const decodedSearch = search ? decodeURIComponent(search) : "";
            return `${origin}${pathname}${decodedSearch}${hash}`;
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

/** infobox 인라인 스타일 preset */
function getInfoboxPreset(
  boxType: string
): {
  container: React.CSSProperties;
  icon: React.CSSProperties & Record<string, any>;
  role: "note" | "alert";
} {
  const baseContainer: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    color: "#1c1d1f",
    boxShadow: "0 1px 0 rgba(0,0,0,.02)",
  };

  const map: Record<
    string,
    {
      bg: string;
      bd: string;
      accent: string;
      mask: string;
      role: "note" | "alert";
    }
  > = {
    info: {
      bg: "#f2f6ff",
      bd: "#dbeafe",
      accent: "#2563eb",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-info.svg?v=2&token=a463935e93",
      role: "note",
    },
    warning: {
      bg: "#fff7ea",
      bd: "#ffe3b3",
      accent: "#f59e0b",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93",
      role: "note",
    },
    danger: {
      bg: "#fff3f3",
      bd: "#ffd8d8",
      accent: "#ef4444",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/triangle-exclamation.svg?v=2&token=a463935e93",
      role: "alert",
    },
    tip: {
      bg: "#eefdf6",
      bd: "#c9f1de",
      accent: "#10b981",
      mask:
        "https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93",
      role: "note",
    },
  };

  const sel = map[boxType] ?? map.info;

  const container: React.CSSProperties = {
    ...baseContainer,
    background: sel.bg,
    border: `1px solid ${sel.bd}`,
  };

  const icon: React.CSSProperties & Record<string, any> = {
    flex: "0 0 auto",
    width: 18,
    height: 18,
    backgroundColor: sel.accent,
    WebkitMaskImage: `url(${sel.mask})`,
    maskImage: `url(${sel.mask})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return { container, icon, role: sel.role };
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

  // URL 파싱
  const parsedUrl = React.useMemo(() => {
    if (!el.url) return null;
    try {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://dummy.local';
      return new URL(el.url, base);
    } catch {
      return null;
    }
  }, [el.url]);

  // 내부 위키 링크 판별
  const isWikiLink = React.useMemo(() => {
    if (el.isWiki) return true;
    if (!parsedUrl) return false;

    if (typeof window === 'undefined') {
      return parsedUrl.pathname.startsWith('/wiki');
    }

    const sameHost = parsedUrl.host === window.location.host;
    return sameHost && parsedUrl.pathname.startsWith('/wiki');
  }, [el.isWiki, parsedUrl]);

  // 표시용 사이트 이름
  let displaySitename = el.sitename ?? '';
  if (!isWikiLink && !displaySitename && parsedUrl) {
    const host = parsedUrl.hostname.replace(/^www\./, '');
    displaySitename = host;
  }

  // 위키 아이콘 상태
  const [wikiIcon, setWikiIcon] = useState<string | null>(
    isWikiLink ? (el.docIcon ?? null) : null,
  );

  // ✅ Element.tsx와 동일한 아이콘 결정 로직
  useEffect(() => {
    if (!isWikiLink || !parsedUrl) return;
    if (typeof window === 'undefined') return;

    const urlObj = parsedUrl;

    const urlPathParam = urlObj.searchParams.get('path');
    const urlTitleParam = urlObj.searchParams.get('title');

    const pathParam =
      urlPathParam ?? (el.wikiPath != null ? String(el.wikiPath) : null);
    const titleParam = urlTitleParam ?? el.wikiTitle ?? null;

    const rawHash = urlObj.hash ? urlObj.hash.slice(1) : '';
    const decodedHash = rawHash
      ? (() => {
          try {
            return decodeURIComponent(rawHash);
          } catch {
            return rawHash;
          }
        })()
      : '';

    // 문서 키 (path + title 조합, 없으면 pathname)
    const docKeyParts: string[] = [];
    if (pathParam) docKeyParts.push(`p:${pathParam}`);
    if (titleParam) docKeyParts.push(`t:${titleParam}`);
    const baseDocKey = docKeyParts.join('|') || urlObj.pathname;

    // 링크별 최종 아이콘 캐시 키
    const cacheKey = `${baseDocKey}#${decodedHash || 'root'}`;

    if (wikiDocIconCache.has(cacheKey)) {
      const cached = wikiDocIconCache.get(cacheKey)!;
      if (cached) setWikiIcon(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let detail = wikiDocDetailCache.get(baseDocKey);

        // 아직 문서 디테일이 없으면 /api/documents 에서 가져오기
        if (!detail) {
          let res: Response | null = null;

          if (pathParam || titleParam) {
            const qs: string[] = [];
            if (pathParam) qs.push(`path=${encodeURIComponent(pathParam)}`);
            if (titleParam) qs.push(`title=${encodeURIComponent(titleParam)}`);
            const query = qs.join('&');
            res = await fetch(`/api/documents?${query}`, {
              cache: 'force-cache',
            });
          }

          if (!res || !res.ok) {
            wikiDocIconCache.set(cacheKey, '');
            return;
          }

          const data = await res.json();
          const rawContent = (data as any).content;
          const slateContent =
            typeof rawContent === 'string'
              ? JSON.parse(rawContent)
              : rawContent;

          let headingsMeta: WikiDocHeadingMeta[] = [];
          try {
            const hs = extractHeadings(
              Array.isArray(slateContent) ? slateContent : [],
            );
            headingsMeta = hs.map((h: any) => ({
              id: String(h.id ?? ''),
              icon: h.icon ?? null,
            }));
          } catch {
            headingsMeta = [];
          }

          detail = {
            icon: ((data as any).icon ?? '').trim() || null,
            headings: headingsMeta,
          };
          wikiDocDetailCache.set(baseDocKey, detail);
        }

        // 1) 해시가 있으면 해당 heading 아이콘 우선
        let iconCandidate: string | null = null;
        if (decodedHash && detail.headings.length > 0) {
          const target = decodedHash;
          const normalizedTarget = target.startsWith('heading-')
            ? target
            : `heading-${target}`;

          const matched = detail.headings.find((h) => {
            const hid = h.id || '';
            const hidNorm = hid.startsWith('heading-') ? hid : `heading-${hid}`;
            return (
              hid === target ||
              hid === normalizedTarget ||
              hidNorm === target ||
              hidNorm === normalizedTarget
            );
          });

          if (matched?.icon) iconCandidate = matched.icon || null;
        }

        // 2) 못 찾으면 문서 아이콘
        if (!iconCandidate) iconCandidate = detail.icon || null;

        if (!cancelled) {
          if (iconCandidate) {
            setWikiIcon(iconCandidate);
            wikiDocIconCache.set(cacheKey, iconCandidate);
          } else {
            wikiDocIconCache.set(cacheKey, '');
          }
        }
      } catch {
        if (!cancelled) {
          wikiDocIconCache.set(cacheKey, '');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isWikiLink, parsedUrl, el.wikiPath, el.wikiTitle]);

  // 외부 링크 파비콘
  const externalFavicon: string | null =
    !isWikiLink && parsedUrl ? `${parsedUrl.origin}/favicon.ico` : null;

  const isSmall = el.size === 'small' || el.size === 'half';

  const wrapperStyle: React.CSSProperties = isSmall
    ? {
        // ✅ flex row 안에서는 flex item으로 반반 배치
        flex: "1 1 calc(50% - 6px)",
        width: "calc(50% - 6px)",
        maxWidth: "calc(50% - 6px)",
        boxSizing: "border-box",

        // ✅ inline-block + marginRight 때문에 2개가 1줄에 안 들어가던 문제 제거
        display: "block",
      }
    : { display: "block", width: "100%", maxWidth: "100%" };

  const labelText =
    nodeToPlainText(node.children) ||
    (isWikiLink
      ? el.wikiTitle || el.sitename || '문서'
      : displaySitename || el.url || '링크');

  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <a
        href={el.url}
        target={isWikiLink ? undefined : '_blank'}
        rel={isWikiLink ? undefined : 'noopener noreferrer nofollow'}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: 15,
            fontSize: 16,
            border: '1px solid #ddd',
            borderRadius: 6,
            marginBottom: 8,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* 아이콘 영역 */}
          {isWikiLink ? (
            wikiIcon ? (
              wikiIcon.startsWith('http') ? (
                <SmartImage
                  src={withVersion(cdn(wikiIcon))}
                  alt="doc icon"
                  width={24}
                  height={24}
                  style={{
                    width: 24,
                    height: 24,
                    marginRight: 8,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 20,
                    marginRight: 8,
                    lineHeight: 1,
                  }}
                >
                  {wikiIcon}
                </span>
              )
            ) : (
              <span
                style={{
                  width: 24,
                  height: 24,
                  marginRight: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
                aria-hidden
              >
                📄
              </span>
            )
          ) : externalFavicon ? (
            <img
              src={externalFavicon}
              alt=""
              loading="lazy"
              decoding="async"
              width={20}
              height={20}
              style={{
                width: 20,
                height: 20,
                marginRight: 8,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <span
              style={{
                width: 24,
                height: 24,
                marginRight: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
              }}
              aria-hidden
            >
              ↗️
            </span>
          )}

          {/* 텍스트 */}
          <span
            style={{
              flexGrow: 1,
              color: '#0070f3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {labelText}
          </span>
        </div>
      </a>
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

function nameFontSize(name?: string) {
  const n = (name ?? "").trim();
  if (n.length >= 9) return 16;
  if (n.length >= 7) return 18;
  return 20;
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
  | "ancient";

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
};

// 공격 영상 모달 (문서 보기에서도 사용)
type WeaponVideoModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

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

    // 그 외의 빈 단락은 유지 (의도된 줄바꿈 가능성)
    out.push(cur);
  }

  return out;
}

// 메인 렌더 컴포넌트
export default function WikiReadRenderer({ content }: { content: Descendant[]; }) {
  const [copiedHeadingId, setCopiedHeadingId] = useState<string | null>(null);

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
      const { origin, pathname, search } = window.location;
      const decodedSearch = search ? decodeURIComponent(search) : "";
      const url = `${origin}${pathname}${decodedSearch}#${encodeURIComponent(
        headingId
      )}`;
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
          {renderNode(a, i, ctx)}
          {renderNode(b, i + 1, ctx)}
        </div>
      );

      i += 1; // 2개 처리했으니 한 칸 더 스킵
      continue;
    }

    // (2) 나머지는 기존처럼 단건 렌더
    rendered.push(renderNode(node, i, ctx));
  }

  return <>{rendered}</>;
}

function PriceTableCardBlock({
  node,
  keyProp,
}: {
  node: any;
  keyProp: React.Key;
}) {
  const [indexes, setIndexes] = useState<number[]>(() =>
    node.items.map(() => 0)
  );
  const [hovered, setHovered] = useState<number | null>(null);

  const setCardIdx = (cardIdx: number, dir: -1 | 1) => {
    setIndexes((prev) => {
      const copy = [...prev];
      const item = node.items[cardIdx];
      if (!item) return copy;
      const len = item.stages?.length || 1;
      copy[cardIdx] = (copy[cardIdx] + dir + len) % len;
      return copy;
    });
  };

  return (
    <div
      key={keyProp}
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
        {node.items.map((item: any, idx: number) => {
          const stages: string[] = item.stages || ["가격"];
          const prices: Array<string | number> =
            Array.isArray(item.prices) && item.prices.length
              ? item.prices
              : Array(stages.length).fill(0);

          const cardIdx = indexes[idx] ?? 0;
          const stage = stages[cardIdx] || "";
          const priceVal = prices[cardIdx] ?? "";
          const badgeColor = getPriceBadgeColor(stage, item.colorType);

          const name = item.name?.trim() ? item.name : "이름 없음";
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
                background: "#fff",
              }}
            />
          ) : (
            <span
              style={{
                width: 54,
                height: 54,
                background: "#ececec",
                borderRadius: 7,
                display: "inline-block",
              }}
            />
          );

          const badge =
            stages.length > 1 ? (
              <div
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
                    border: "1.5px solid #fff",
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
              style={{
                background: "#fff",
                borderRadius: 15,
                padding: 8,
                boxShadow: "0 4px 24px 0 rgba(60,60,80,0.12)",
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
                  style={{
                    position: "absolute",
                    left: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "#fff",
                    border: "1.2px solid #eee",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    boxShadow: "0 2px 6px #0001",
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
                  style={{
                    position: "absolute",
                    right: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "#fff",
                    border: "1.2px solid #eee",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    boxShadow: "0 2px 6px #0001",
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

              {/* 이름: 길면 폰트 축소(여백/카드크기 불변) */}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: nameFontSize(item.name),
                  lineHeight: 1.12,
                  marginBottom: 0,
                  color: item.name ? "#333" : "#bbb",
                  textAlign: "center",
                  minHeight: 24,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {name}
              </div>

              {/* 가격: 필요시에만 ~ 뒤가 다음 줄로 + 길면 폰트 축소 */}
              <div
                style={{
                  fontWeight: 800,
                  fontSize: priceSize,
                  lineHeight: 1.04,
                  color: "#5b80f5",
                  textAlign: "center",
                  letterSpacing: "1px",
                  marginTop: 3,
                  borderRadius: 8,
                  padding: "2px 10px",
                  minHeight: 28,
                }}
              >
                <PriceText value={priceVal} />
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
};

/** 카드 오른쪽 바깥에 붙는 강수 선택 버튼 (단색 뱃지 + MAX만 다른 색) */
function WeaponLevelSelector({
  levelLabels,
  selectedIndex,
  onChange,
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
  const DOT = 30; // 기존 22 → 30
  const DOT_FONT = 13; // 기존 11 → 13
  const TOP_FONT = 14; // 기존 13 → 14
  const DOT_SHADOW = "0 10px 24px rgba(15,23,42,0.22), 0 2px 6px rgba(15,23,42,0.12)";
  const DOT_SHADOW_ACTIVE = "0 12px 28px rgba(37,99,235,0.18), 0 2px 8px rgba(15,23,42,0.12)";

  return (
    <div
      style={{
        position: "relative",
        marginLeft: 10,          // 살짝만 여유
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
          gap: 8,                 // 기존 4 → 8
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
            fontSize: 12,          // 기존 10 → 12
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
          right: 13,
          marginTop: 8,           // 기존 4 → 8
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
            gap: 10,              // 기존 6 → 10 (더 고급스럽게 여백)
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

function WeaponCardRead({ node, keyProp }: { node: any; keyProp: React.Key }) {
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

  const rawVideo = node.videoUrl || "";
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

  const cardWidth = 260; // 🔹 Element 와 동일

  return (
    <div key={keyProp} style={{ margin: "14px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {/* 카드 본체 – Element 와 거의 동일한 스타일 */}
        <div
          style={{
            width: cardWidth,
            borderRadius: 18,
            overflow: "hidden",
            background: "#020617",
            boxShadow: "0 18px 45px rgba(0,0,0,.45)",
            fontFamily: "inherit",
            paddingTop: 8,
          }}
        >
          {/* 상단 타입 바 */}
          <div
            style={{
              width: "100%",
              background: meta.headerBg,
              color: "#f9fafb",
              padding: "6px 0",
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
            style={{
              padding: "10px 14px",
              background: "#020617",
              color: "#e5e7eb",
              fontSize: 18,
              fontWeight: 700,
              textAlign: "center",
              borderBottom: "1px solid #111827",
            }}
          >
            {name}
          </div>

          {/* 이미지 영역 */}
          <div
            style={{
              background:
                "radial-gradient(circle at 20% 0%, rgba(56,189,248,0.18), transparent 55%), " +
                "radial-gradient(circle at 100% 0%, rgba(129,140,248,0.22), transparent 55%), " +
                "#020617",
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
                sizes="(max-width: 768px) 80vw, 260px"
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
                  color: "#6b7280",
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
                  color: "#6b7280",
                  padding: "6px 8px",
                  borderRadius: 10,
                  background: "rgba(15,23,42,.75)",
                }}
              >
                표시할 정보가 없습니다.
              </div>
            )}

            {enabledStats.map((stat) => {
              const { value, unit } = getStatDisplay(stat);
              return (
                <div
                  key={stat.key || stat.label}
                  style={{
                    borderRadius: 10,
                    padding: "6px 8px",
                    border: "1px solid #111827",
                    background:
                      "linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      fontWeight: 500,
                    }}
                  >
                    {stat.label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#e5e7eb",
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
          <div
            style={{
              padding: "8px 10px 10px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
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
                  : "#111827",
                color: videoSrc ? "#f9fafb" : "#6b7280",
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
        </div>

        {/* 오른쪽 강수 선택 버튼 */}
        {levelLabels.length > 1 && (
          <WeaponLevelSelector
            levelLabels={levelLabels}
            selectedIndex={selectedLevelIndex}
            onChange={(idx) => setSelectedLevelIndex(idx)}
          />
        )}
      </div>

      {/* 영상 모달 */}
      {videoSrc && (
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
function renderLeaf(node: any, key?: React.Key): React.ReactNode {
  let children = node.text;
  if (node.bold) children = <strong>{children}</strong>;
  if (node.italic) children = <em>{children}</em>;
  if (node.underline) children = <u>{children}</u>;
  if (node.strikethrough) children = <s>{children}</s>;

  const style: React.CSSProperties = {};

  // 색/배경
  if (node.color) style.color = node.color;
  if (node.backgroundColor) style.backgroundColor = node.backgroundColor;

  // 🎯 폰트 패밀리 (boolean 방어 + 기본값 적용)
  const rawFamily = node.fontFamily;
  let familyKey: string; // HANDWRITING_SCALE용 키
  let familyCss: string; // 실제 CSS에 넣을 값

  if (typeof rawFamily === "string" && rawFamily.trim()) {
    familyKey = rawFamily.trim(); // 예: 'BareunHippy'
    familyCss = familyKey; // 그대로 사용
  } else {
    // 마크가 없거나 잘못(true 등) 들어간 경우 → 기본 글꼴
    familyKey = "NanumSquareRound";
    familyCss =
      "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  }

  style.fontFamily = familyCss;

  // 폰트 크기 + 손글씨 보정
  const normalized = normalizeFontSize(node.fontSize);  
  const basePx = toPxNumber(normalized as any);
  const scale = HANDWRITING_SCALE[familyKey] ?? 1;

  if (scale !== 1) {
    if (typeof basePx === "number") {
      style.fontSize = `${Math.round(basePx * scale)}px`;
    } else if (normalized !== undefined) {
      style.fontSize = normalized as any;
    } else {
      style.fontSize = `${scale}em`;
    }
    style.lineHeight = style.lineHeight ?? 1.35;
  } else {
    if (normalized !== undefined) style.fontSize = normalized as any;
  }

  return (
    <span key={key} style={style}>
      {children}
    </span>
  );
}

// 노드 타입별 렌더링 (재귀)
function renderNode(
  node: any,
  key?: React.Key,
  ctx?: HeadingCopyCtx
): React.ReactNode {
  if (Text.isText(node)) {
    return renderLeaf(node, key);
  }

  const children = node.children?.map((n: any, i: number) =>
    renderNode(n, key ? `${key}-${i}` : i, ctx)
  );

  switch (node.type) {
    case "paragraph": {
      const indentLine = node.indentLine;

      // 에디터와 동일한 라인 높이 & 빈 단락 최소 높이 보장
      const plainText = stripReact(children).replace(/\u200B/g, "").trim();
      const isEmpty = plainText.length === 0;

      const style: React.CSSProperties = {
        textAlign: node.textAlign || "left",
        margin: 0,
        lineHeight: 1.6,
        fontSize: "19px",
        minHeight: isEmpty ? "1.6em" : undefined,
      };
      if (indentLine) {
        style.borderLeft = "2px solid #aaa";
        style.paddingLeft = 16;
      }
      return (
        <p key={key} style={style}>
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
      const id = toHeadingIdFromText(textContent);

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
          id={id}
          suppressHydrationWarning
          className="wiki-heading-with-anchor"
          style={{
            fontSize,
            textAlign: el.textAlign || "left",
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
          }}
        >
          {iconHtml}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{safeChildren}</span>
            {/* 🔗 제목과 동일 디자인의 링크 버튼 */}
            <HeadingAnchorButton anchorId={id} />
          </span>
        </Tag>
      );
    }

    case "link":
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{ color: "#2676ff", textDecoration: "underline" }}
        >
          {children}
        </a>
      );

    case "divider": {
      const borderColor = "#e0e0e0";
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
                  color: "#666",
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
                  color: "#666",
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

    // 링크 블록(박스형)
    case "link-block": {
      return (
        <LinkBlockView key={key} node={node}>
          {children}
        </LinkBlockView>
      );
    }

    // 내부적으로도 사용되는 컨테이너
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
      const type = (node.boxType || "info").toLowerCase();
      const { container, icon, role } = getInfoboxPreset(type);
      return (
        <div key={key} role={role} style={{ ...container, margin: "8px 0" }}>
          <span aria-hidden="true" style={icon as React.CSSProperties} />
          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              lineHeight: 1.55,
              fontWeight: 560,
              color: "#1c1d1f",
            }}
          >
            {children}
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
                style={{ boxShadow: "0 2px 12px 0 #0001", background: "#fff" }}
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
            color: node.color || "#888",
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
      return <WeaponCardRead node={node} keyProp={key ?? ""} />;
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

      return (
        <td
          key={key}
          colSpan={colSpan}
          rowSpan={rowSpan}
          style={{
            border: "1px solid #e5e7eb",
            padding: "6px 8px",
            verticalAlign: "top",
            background: "#ffffff",
          }}
        >
          {children}
        </td>
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
  if (React.isValidElement(node)) return stripReact(node.props.children);
  return "";
}
