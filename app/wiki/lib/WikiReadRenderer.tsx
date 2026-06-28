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

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { Descendant, Text } from "slate";

// ⬇️ 추가: CDN 치환/버전 유틸 + 최적화 이미지 컴포넌트
import SmartImage from "@/components/common/SmartImage";
import { cdn, withVersion } from "@lib/cdn";

import type { WikiRefKind } from '@/components/editor/render/types';

import DividerBlock from '@/components/wiki-render/blocks/DividerBlock';

import ParagraphBlock from '@/components/wiki-render/blocks/ParagraphBlock';

import HeadingBlock from '@/components/wiki-render/blocks/HeadingBlock';

import InfoBoxBlock from '@/components/wiki-render/blocks/InfoBoxBlock';

import MediaBlock from '@/components/wiki-render/blocks/MediaBlock';

import TableBlock from '@/components/wiki-render/blocks/TableBlock';

import InlineWikiLink from '@/components/wiki-render/link/InlineWikiLink';
import LinkCardRenderer from '@/components/wiki-render/link/LinkCardRenderer';
import {
  isInternalWikiHref as sharedIsInternalWikiHref,
  normalizeToAppHref as sharedNormalizeToAppHref,
} from '@/components/wiki-render/link/linkUtils';

import {
  FootnoteInline as SharedFootnoteInline,
  InlineImage,
  InlineMark,
  LeafRenderer,
  WikiRefInline,
} from '@/components/wiki-render/inline';

import InlineLinkRenderer from '@/components/wiki-render/link/InlineLinkRenderer';

import {
  WikiTableCellRenderer,
  WikiTableRowRenderer,
} from '@/components/wiki-render/table/TableRenderer';

import WeaponCardRead from '@/components/wiki-render/weapon/WeaponCardRead';
import PriceTableRead from '@/components/wiki-render/price-table/PriceTableRead';

type Props = {
  content: Descendant[];
  readOnly?: boolean;
  onWikiRefClick?: (kind: WikiRefKind, id: number) => void | Promise<void>;
  onWikiNavigate?: (href: string) => void;
};

const FOOTNOTE_HOVER_EVENT = "rdwiki:footnote-hover";

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

type FootnoteInlineProps = {
  label: string;
  content: string;
};

const FootnoteInline: React.FC<FootnoteInlineProps> = ({ label, content }) => {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const desktopTooltipRef = useRef<HTMLSpanElement | null>(null);

  const [open, setOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [desktopTooltipPos, setDesktopTooltipPos] = useState<{
    left: number;
    top: number;
    arrowLeft: number;
  }>({
    left: 0,
    top: 0,
    arrowLeft: 20,
  });

  const safeLabel = String(label ?? "").trim() || "각주";
  const safeContent = String(content ?? "").trim();
  const hasContent = safeContent.length > 0;

  const notifyFootnoteHover = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(FOOTNOTE_HOVER_EVENT));
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileViewport(mq.matches);

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (isMobileViewport) return;

      if (rootRef.current?.contains(target)) return;
      if (desktopTooltipRef.current?.contains(target)) return;

      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isMobileViewport]);

  const updateDesktopTooltipPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!rootRef.current || !desktopTooltipRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const tooltipRect = desktopTooltipRef.current.getBoundingClientRect();

    const sidePadding = 12;
    const gap = 10;

    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    left = Math.max(
      sidePadding,
      Math.min(left, window.innerWidth - sidePadding - tooltipRect.width)
    );

    let top = triggerRect.top - gap - tooltipRect.height;
    top = Math.max(12, top);

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    let arrowLeft = triggerCenterX - left;
    arrowLeft = Math.max(14, Math.min(arrowLeft, tooltipRect.width - 14));

    setDesktopTooltipPos({
      left,
      top,
      arrowLeft,
    });
  }, []);

  useLayoutEffect(() => {
    if (!portalReady || !open || isMobileViewport || !hasContent) return;

    let raf = 0;

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        updateDesktopTooltipPosition();
      });
    };

    schedule();

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [portalReady, open, isMobileViewport, hasContent, updateDesktopTooltipPosition]);

  const openDesktop = () => {
    if (!hasContent || isMobileViewport) return;
    notifyFootnoteHover();
    setOpen(true);
  };

  const closeDesktop = () => {
    if (isMobileViewport) return;
    setOpen(false);
  };

  const openMobileModal = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!hasContent || !isMobileViewport) return;
    e.preventDefault();
    e.stopPropagation();
    notifyFootnoteHover();
    setOpen(true);
  };

  const closeMobileModal = () => {
    setOpen(false);
  };
  const showDesktopTooltip = portalReady && !isMobileViewport && open && hasContent;
  const tooltipVisible = showDesktopTooltip;

  const desktopTooltipStyle: React.CSSProperties = {
    pointerEvents: "none",
    position: "fixed",
    left: desktopTooltipPos.left,
    top: desktopTooltipPos.top,
    transform: tooltipVisible ? "translateY(0)" : "translateY(6px)",
    opacity: tooltipVisible ? 1 : 0,
    visibility: tooltipVisible ? "visible" : "hidden",
    zIndex: 9998,

    width: "max-content",
    minWidth: 120,
    maxWidth: 340,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",

    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-elevated)",
    color: "var(--foreground)",
    boxShadow: "var(--shadow-lg)",

    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.55,
    letterSpacing: "-0.1px",
    textAlign: "left",

    transition:
      "opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease",
  };

  const desktopTooltip =
    showDesktopTooltip
      ? createPortal(
          <span
            ref={desktopTooltipRef}
            role="tooltip"
            aria-hidden={!open}
            style={desktopTooltipStyle}
          >
            {safeContent}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: desktopTooltipPos.arrowLeft,
                bottom: -7,
                width: 12,
                height: 12,
                transform: tooltipVisible
                  ? "translateX(-50%) rotate(45deg)"
                  : "translateX(-50%) translateY(-2px) rotate(45deg)",
                opacity: tooltipVisible ? 1 : 0,
                visibility: tooltipVisible ? "visible" : "hidden",
                background: "var(--surface-elevated)",
                borderRight: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                transition:
                  "opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease",
              }}
            />
          </span>,
          document.body
        )
      : null;

  const mobileModal =
  portalReady && isMobileViewport && hasContent
    ? createPortal(
        <div
          onClick={closeMobileModal}
          role="dialog"
          aria-modal="true"
          aria-label={`각주 ${safeLabel}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: open ? "rgba(15, 23, 42, 0.38)" : "rgba(15, 23, 42, 0)",
            backdropFilter: open ? "blur(2px)" : "blur(0px)",
            WebkitBackdropFilter: open ? "blur(2px)" : "blur(0px)",
            opacity: open ? 1 : 0,
            visibility: open ? "visible" : "hidden",
            pointerEvents: open ? "auto" : "none",
            transition:
              "opacity 0.16s ease, visibility 0.16s ease, background 0.16s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, calc(100vw - 32px))",
              maxHeight: "min(70vh, 520px)",
              overflowY: "auto",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--surface-elevated)",
              color: "var(--foreground)",
              boxShadow: "var(--shadow-lg)",
              padding: "16px 16px 14px",
              transform: open ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
              transition: "transform 0.16s ease, opacity 0.16s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#7c3aed",
                  lineHeight: 1.2,
                }}
              >
                [{safeLabel}]
              </div>

              <button
                type="button"
                onClick={closeMobileModal}
                aria-label="각주 닫기"
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--foreground)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
            </div>

            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              }}
            >
              {safeContent}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <SharedFootnoteInline
        ref={rootRef}
        mode="read"
        label={safeLabel}
        tabIndex={hasContent ? 0 : -1}
        ariaLabel={hasContent ? `각주: ${safeContent}` : `각주 ${safeLabel}`}
        onMouseEnter={() => {
          notifyFootnoteHover();
          openDesktop();
        }}
        onMouseLeave={closeDesktop}
        onFocus={() => {
          notifyFootnoteHover();
          openDesktop();
        }}
        onBlur={closeDesktop}
        onClick={openMobileModal}
        style={{
          cursor: hasContent ? (isMobileViewport ? 'pointer' : 'help') : 'default',
        }}
      />

      {desktopTooltip}
      {mobileModal}
    </>
  );
};

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

// 내부 텍스트 추출 함수 (Element 쪽에서 Node.string 대신 사용하는 버전)
function nodeToPlainText(node: any): string {
  if (!node) return '';
  if (Text.isText(node)) return node.text ?? '';
  if (Array.isArray(node)) return node.map(nodeToPlainText).join('');
  if (Array.isArray(node.children)) return node.children.map(nodeToPlainText).join('');
  return '';
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
export default function WikiReadRenderer({
  content,
  readOnly = true,
  onWikiRefClick,
  onWikiNavigate,
}: Props) {
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
          <LinkCardRenderer
            key={`link-block-row-${i}-a`}
            mode="read"
            url={(a as any).url}
            isWiki={(a as any).isWiki}
            wikiPath={(a as any).wikiPath}
            wikiTitle={(a as any).wikiTitle}
            sitename={(a as any).sitename}
            size={(a as any).size}
            docIcon={(a as any).docIcon}
            labelText={nodeToPlainText((a as any).children)}
            compactMobile={isMobile}
            onWikiNavigate={onWikiNavigate}
          />

          <LinkCardRenderer
            key={`link-block-row-${i}-b`}
            mode="read"
            url={(b as any).url}
            isWiki={(b as any).isWiki}
            wikiPath={(b as any).wikiPath}
            wikiTitle={(b as any).wikiTitle}
            sitename={(b as any).sitename}
            size={(b as any).size}
            docIcon={(b as any).docIcon}
            labelText={nodeToPlainText((b as any).children)}
            compactMobile={isMobile}
            onWikiNavigate={onWikiNavigate}
          />
        </div>
      );

      i += 1; // 2개 처리했으니 한 칸 더 스킵
      continue;
    }

    // (2) 나머지는 기존처럼 단건 렌더
    rendered.push(
      renderNode(node, i, ctx, handlers, {
        isMobile,
        isDarkMode,
        onWikiNavigate,
      })
    );
  }

  return <>{rendered}</>;
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
  },
): React.ReactNode {
  return (
    <LeafRenderer
      key={key}
      mode="read"
      leaf={node}
      env={env}
    />
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
    inLinkBlockRow?: boolean;
    onWikiNavigate?: (href: string) => void;
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
      const isMobileTableText = !!env?.isMobile && !!env?.inTableCell;

      return (
        <ParagraphBlock
          mode="read"
          textAlign={node.textAlign || "left"}
          indentLine={Boolean(indentLine)}
          plainText={plainText}
          isMobileTableText={isMobileTableText}
        >
          {children}
        </ParagraphBlock>
      );
    }

    case "heading-one":
    case "heading-two":
    case "heading-three": {
      const el = node;

      const safeChildren = (el.children ?? []).map((child: any, i: number) =>
        renderNode(stripFontSizeFromDescendants(child), key ? `${key}-${i}` : i)
      );

      const textContent = stripReact(safeChildren).trim();
      const baseId = toHeadingIdFromText(textContent);

      const occ = ctx?.headingOccRef.current.get(baseId) ?? 0;
      ctx?.headingOccRef.current.set(baseId, occ + 1);

      const domId = `${baseId}--${occ}`;
      const level = node.type === "heading-one" ? 1 : node.type === "heading-two" ? 2 : 3;

      return (
        <HeadingBlock
          mode="read"
          level={level}
          textAlign={node.textAlign || "left"}
          icon={el.icon}
          domId={domId}
          dataHeadingId={baseId}
        >
          {safeChildren}
        </HeadingBlock>
      );
    }

    case "link": {
      const href = String(node.url ?? node.href ?? "").trim();
      const isInternalWikiLink = href ? sharedIsInternalWikiHref(href) : false;

      if (isInternalWikiLink) {
        return (
          <InlineWikiLink
            href={href}
            onWikiNavigate={env?.onWikiNavigate}
          >
            {children}
          </InlineWikiLink>
        );
      }

      return (
        <InlineLinkRenderer
          mode="read"
          href={href || "#"}
          attributes={{
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          }}
        >
          {children}
        </InlineLinkRenderer>
      );
    }

    case "divider": {
      return (
        <DividerBlock
          mode="read"
          styleType={node.style || 'default'}
        />
      );
    }

    case "link-block": {
      const isHalfSized = node?.size === "small" || node?.size === "half";
      const labelText = nodeToPlainText(node.children);

      return (
        <LinkCardRenderer
          key={key}
          mode="read"
          url={node.url}
          isWiki={node.isWiki}
          wikiPath={node.wikiPath}
          wikiTitle={node.wikiTitle}
          sitename={node.sitename}
          size={node.size}
          docIcon={node.docIcon}
          labelText={labelText}
          compactMobile={!!env?.isMobile && !!env?.inLinkBlockRow && isHalfSized}
          onWikiNavigate={env?.onWikiNavigate}
        />
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
          {node.children?.map((child: any, i: number) =>
            renderNode(
              child,
              key ? `${key}-${i}` : i,
              ctx,
              handlers,
              {
                ...env,
                inLinkBlockRow: true,
              }
            )
          )}
        </div>
      );
    }

    case "info-box": {
      const raw =
        node.boxType ??
        node.variant ??
        node.tone ??
        node.infoType ??
        "note";

      const sourceChildren = env?.isMobile
        ? (node.children ?? []).map(normalizeInfoBoxNodeForMobile)
        : (node.children ?? []);

      const infoChildren = sourceChildren.map((child: any, i: number) =>
        renderNode(child, key ? `${key}-info-${i}` : i, ctx, handlers, env)
      );

      return (
        <InfoBoxBlock
          mode="read"
          tone={raw}
          noIcon={Boolean(node.noIcon)}
        >
          {infoChildren}
        </InfoBoxBlock>
      );
    }

    // 이미지 블록 (SmartImage로 최적화 + CDN/버전)
    case "image": {
      const v = (node.updatedAt || node.version) as string | number | undefined;
      const src = withVersion(cdn(node.url), v);
      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <MediaBlock
          mode="read"
          kind="image"
          src={src}
          alt={node.alt || ""}
          textAlign={node.textAlign}
          width={w}
          height={h}
          renderImage={({ src, alt, width, height, style, className }) => (
            <SmartImage
              src={src}
              alt={alt || ""}
              width={width ?? 960}
              height={height ?? 540}
              className={className}
              loading="lazy"
              decoding="async"
              style={style}
            />
          )}
        />
      );
    }

    // 영상 블록: 이미지와 동일한 정렬(textAlign) + CDN/버전 적용
    case "video": {
      const v = (node.updatedAt || node.version) as string | number | undefined;
      const src = withVersion(cdn(node.url), v);
      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <MediaBlock
          mode="read"
          kind="video"
          src={src}
          textAlign={node.textAlign}
          width={w}
          height={h}
        />
      );
    }

    case "inline-image": {
      const rawSrc = String(node.url ?? node.src ?? "").trim();
      const version = (node.updatedAt || node.version) as string | number | undefined;
      const src = rawSrc ? withVersion(cdn(rawSrc), version) : "";

      const hasExplicitWidth =
        node.width != null && Number.isFinite(Number(node.width));

      const hasExplicitHeight =
        node.height != null && Number.isFinite(Number(node.height));

      return (
        <InlineImage
          mode="read"
          src={src}
          width={hasExplicitWidth ? Number(node.width) : undefined}
          height={hasExplicitHeight ? Number(node.height) : undefined}
        />
      );
    }

    case "inline-mark": {
      return (
        <InlineMark
          mode="read"
          icon={node.icon}
          color={node.color}
        >
          {children}
        </InlineMark>
      );
    }

    case "footnote": {
      const label = String((node as any).label ?? "").trim() || "각주";
      const content = String((node as any).content ?? "").trim();

      return (
        <FootnoteInline
          key={key}
          label={label}
          content={content}
        />
      );
    }

    case "price-table-card": {
      return <PriceTableRead key={key} node={node} />;
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
        typeof node.maxWidth === "number"
          ? node.maxWidth
          : typeof node.maxWidth === "string" && Number.isFinite(Number(node.maxWidth))
            ? Number(node.maxWidth)
            : undefined;

      const tableWidth = widthPx
        ? `${widthPx}px`
        : node.fullWidth
          ? "100%"
          : "auto";

      const tableNode = (
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: tableWidth,
            maxWidth: "100%",
          }}
        >
          <tbody>{children}</tbody>
        </table>
      );

      return (
        <TableBlock
          mode="read"
          containerStyle={{
            display: "flex",
            justifyContent: justify,
            width: "100%",
            margin: "16px 0",
          }}
          table={tableNode}
          scrollable={false}
        />
      );
    }

    case "table-row": {
      return (
        <WikiTableRowRenderer key={key}>
          {children}
        </WikiTableRowRenderer>
      );
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
          },
        ),
      );

      return (
        <WikiTableCellRenderer
          key={key}
          mode="read"
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
        </WikiTableCellRenderer>
      );
    }

    case "wiki-ref": {
      const el = node as any;
      const kind = (el.kind ?? el.refType) as any;
      const id = Number(el.id ?? el.refId);

      const clickable =
        !!handlers?.onWikiRefClick &&
        (handlers?.readOnly ?? true) &&
        Number.isFinite(id) &&
        id > 0;

      return (
        <WikiRefInline
          mode="read"
          clickable={clickable}
          onOpen={() => {
            if (!clickable) return;

            handlers!.onWikiRefClick!(kind, id);
          }}
        >
          {children}
        </WikiRefInline>
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