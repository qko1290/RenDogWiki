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

// ── Element.tsx와 동일한 전역 캐시 (HMR 안전) ─────────────────────
const WIKI_ICON_CACHE_KEY = "__rdwiki_doc_icon_cache__";
const WIKI_DOCS_ALL_KEY = "__rdwiki_docs_all__";

const wikiDocIconCache: Map<string, string> =
  (globalThis as any)[WIKI_ICON_CACHE_KEY] ?? new Map<string, string>();
(globalThis as any)[WIKI_ICON_CACHE_KEY] = wikiDocIconCache;

let wikiDocsAll: any[] | null = (globalThis as any)[WIKI_DOCS_ALL_KEY] ?? null;
const setWikiDocsAll = (rows: any[]) => {
  wikiDocsAll = rows;
  (globalThis as any)[WIKI_DOCS_ALL_KEY] = rows;
};
// ───────────────────────────────────────────────────────────────

function toHeadingIdFromText(text: string) {
  const cleaned = text.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();
  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;
  return `heading-${slug}`;
}

/** 외부 링크용 인라인 아이콘 (파비콘 네트워크 호출 제거) */
const ExternalLinkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z" fill="currentColor"/>
  </svg>
);

/** infobox 인라인 스타일 preset */
function getInfoboxPreset(
  boxType: string
): {
  container: React.CSSProperties;
  icon: React.CSSProperties & Record<string, any>;
  role: 'note' | 'alert';
} {
  const baseContainer: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    color: '#1c1d1f',
    boxShadow: '0 1px 0 rgba(0,0,0,.02)'
  };

  const map: Record<
    string,
    { bg: string; bd: string; accent: string; mask: string; role: 'note' | 'alert' }
  > = {
    info: {
      bg: '#f2f6ff',
      bd: '#dbeafe',
      accent: '#2563eb',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-info.svg?v=2&token=a463935e93',
      role: 'note'
    },
    warning: {
      bg: '#fff7ea',
      bd: '#ffe3b3',
      accent: '#f59e0b',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
      role: 'note'
    },
    danger: {
      bg: '#fff3f3',
      bd: '#ffd8d8',
      accent: '#ef4444',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/triangle-exclamation.svg?v=2&token=a463935e93',
      role: 'alert'
    },
    tip: {
      bg: '#eefdf6',
      bd: '#c9f1de',
      accent: '#10b981',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
      role: 'note'
    }
  };

  const sel = map[boxType] ?? map.info;

  const container: React.CSSProperties = {
    ...baseContainer,
    background: sel.bg,
    border: `1px solid ${sel.bd}`
  };

  const icon: React.CSSProperties & Record<string, any> = {
    flex: '0 0 auto',
    width: 18,
    height: 18,
    backgroundColor: sel.accent,
    WebkitMaskImage: `url(${sel.mask})`,
    maskImage: `url(${sel.mask})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain'
  };

  return { container, icon, role: sel.role };
}

// ── 링크 블록 (읽기 전용) : Element.tsx와 동일 동작 ──────────────
function LinkBlockView({ node, keyProp }: { node: any; keyProp: React.Key }) {
  // 외부 링크: sitename 추론 (파비콘은 네트워크 호출 제거)
  let displaySitename: string | undefined = node.sitename;

  if (!node.isWiki && !displaySitename) {
    try {
      const u = new URL(node.url);
      displaySitename = u.hostname.replace(/^www\./, '');
    } catch {}
  }

  // 내부 문서 링크: 아이콘 로딩
  const [wikiIcon, setWikiIcon] = useState<string | null>(
    node.isWiki ? (node.docIcon ?? null) : null
  );

  useEffect(() => {
    if (!node.isWiki || wikiIcon) return;
    const key = String(node.wikiPath ?? node.url ?? node.wikiTitle ?? '');
    if (!key) return;

    if (wikiDocIconCache.has(key)) {
      setWikiIcon(wikiDocIconCache.get(key)!);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!wikiDocsAll) {
          const res = await fetch('/api/documents?all=1', { cache: 'force-cache' });
          const data = await res.json();
          setWikiDocsAll(Array.isArray(data) ? data : []);
        }
        const docs = wikiDocsAll || [];
        const match = docs.find(
          (d: any) =>
            (node.wikiPath && String(d.path) === String(node.wikiPath)) ||
            (node.wikiTitle && d.title === node.wikiTitle)
        );
        const icon = (match?.icon ?? '').trim();
        if (!cancelled) {
          if (icon) {
            setWikiIcon(icon);
            wikiDocIconCache.set(key, icon);
          } else {
            setWikiIcon(null);
          }
        }
      } catch {
        if (!cancelled) setWikiIcon(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [node.isWiki, node.wikiPath, node.wikiTitle, node.url, wikiIcon]);

  const isSmall = node.size === 'small';
  const flexStyle: React.CSSProperties = isSmall
    ? { flex: '0 0 calc(50% - 6px)', maxWidth: 'calc(50% - 6px)' }
    : { flex: '0 0 100%', maxWidth: '100%' };

  let iconNode: React.ReactNode = null;
  if (node.isWiki) {
    if (wikiIcon) {
      iconNode = wikiIcon.startsWith('http') ? (
        <img
          src={cdn(wikiIcon)}
          alt="doc icon"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{ width: 24, height: 24, marginRight: 8, objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontSize: 20, marginRight: 8, lineHeight: 1 }}>{wikiIcon}</span>
      );
    }
  } else {
    // 외부 파비콘 네트워크 호출 제거 → 인라인 아이콘
    iconNode = (
      <span
        style={{
          width: 24, height: 24, marginRight: 8,
          display: 'inline-flex', alignItems:'center', justifyContent:'center', color:'#64748b'
        }}
      >
        <ExternalLinkIcon size={18} />
      </span>
    );
  }

  return (
    <div key={keyProp} style={{ position: 'relative', ...flexStyle }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 6,
          marginBottom: 8,
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {iconNode}
        <a
          href={node.url}
          target={node.isWiki ? undefined : '_blank'}
          rel={node.isWiki ? undefined : 'noopener noreferrer nofollow'}
          style={{ color: '#0070f3', textDecoration: 'none', flexGrow: 1 }}
        >
          {node.isWiki ? node.wikiTitle || node.sitename || '문서' : displaySitename || node.url}
        </a>
      </div>
    </div>
  );
}

/** 길이에 따라 폰트 자동 축소(대략치) */
function autoFont(base: number, text: string, steps?: Array<[number, number]>) {
  const len = Array.from(text ?? '').length;
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
  const s = String(value ?? '');
  if (!s.includes('~')) return <span className="ptc-price-text">{s}</span>;
  const [left, right] = s.split('~', 2);
  return (
    <span className="ptc-price-text">
      <span style={{ whiteSpace: 'nowrap' }}>{left}~</span>
      <wbr />
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </span>
  );
}

function nameFontSize(name?: string) {
  const n = (name ?? '').trim();
  if (n.length >= 9) return 16;
  if (n.length >= 7) return 18;
  return 20;
}

/** 숫자/문자 폰트 크기를 정규화: 숫자는 px, 단위가 있으면 그대로 */
function normalizeFontSize(v: unknown): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Math.max(1, v);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    if (/(px|rem|em|%|vh|vw)$/i.test(s)) return s;         // 이미 단위가 있으면 그대로
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;          // 숫자면 px
    return s;
  }
  return undefined;
}

/** "16px" → 16 추출 (px만 파싱) */
function toPxNumber(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  const m = /^(-?\d+(?:\.\d+)?)px$/i.exec(v);
  return m ? parseFloat(m[1]) : undefined;
}

/** 손글씨 계열은 기본보다 살짝 크게 보정 */
const HANDWRITING_SCALE: Record<string, number> = {
  BareunHippy: 1.18,                    // 나눔손글씨 바른히피
  NanumHandwritingMiddleSchool: 1.14,   // 나눔손글씨 중학생
};

// 메인 렌더 컴포넌트
export default function WikiReadRenderer({ content }: { content: Descendant[] }) {
  return <>{content.map((node, idx) => renderNode(node, idx))}</>;
}

function PriceTableCardBlock({ node, keyProp }: { node: any; keyProp: React.Key }) {
  const [indexes, setIndexes] = useState<number[]>(() => node.items.map(() => 0));
  const [hovered, setHovered] = useState<number | null>(null);

  const setCardIdx = (cardIdx: number, dir: -1 | 1) => {
    setIndexes(prev => {
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
        position: "relative"
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
          maxWidth: 1040
        }}
      >
        {node.items.map((item: any, idx: number) => {
          const stages: string[] = item.stages || ['가격'];
          const prices: Array<string | number> =
            Array.isArray(item.prices) && item.prices.length
              ? item.prices
              : Array(stages.length).fill(0);

          const cardIdx = indexes[idx] ?? 0;
          const stage = stages[cardIdx] || '';
          const priceVal = prices[cardIdx] ?? '';
          const badgeColor = getPriceBadgeColor(stage, item.colorType);

          const name = item.name?.trim() ? item.name : '이름 없음';
          const priceSize = autoFont(20, String(priceVal));

          const image =
            item.image ? (
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
                  background: "#fff"
                }}
              />
            ) : (
              <span
                style={{
                  width: 54,
                  height: 54,
                  background: "#ececec",
                  borderRadius: 7,
                  display: "inline-block"
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
                  justifyContent: "center"
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
                    transition: "background .1s"
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
                margin: "0 8px"
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
                    opacity: 0.9
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
                    opacity: 0.9
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
                  justifyContent: "center"
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
                  padding: 0
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
                  minHeight: 28
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
  let familyKey: string;        // HANDWRITING_SCALE용 키
  let familyCss: string;        // 실제 CSS에 넣을 값

  if (typeof rawFamily === 'string' && rawFamily.trim()) {
    familyKey = rawFamily.trim();       // 예: 'BareunHippy'
    familyCss = familyKey;              // 그대로 사용
  } else {
    // 마크가 없거나 잘못(true 등) 들어간 경우 → 기본 글꼴
    familyKey = 'NanumSquareRound';
    familyCss =
      "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  }

  style.fontFamily = familyCss;

  // 폰트 크기 + 손글씨 보정
  const normalized = normalizeFontSize(node.fontSize);
  const basePx = toPxNumber(normalized);
  const scale = HANDWRITING_SCALE[familyKey] ?? 1;

  if (scale !== 1) {
    if (typeof basePx === 'number') {
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
function renderNode(node: any, key?: React.Key): React.ReactNode {
  if (Text.isText(node)) {
    return renderLeaf(node, key);
  }

  const children = node.children?.map((n: any, i: number) => renderNode(n, key ? `${key}-${i}` : i));

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

      // 아이콘 처리 (기존 그대로)
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
                display: "inline-block"
              }}
            />
          );
        } else {
          iconHtml = (
            <span
              style={{
                fontSize: "1.5em",
                fontWeight: "600",
                marginRight: 6,
                display: "inline-block"
              }}
            >
              {el.icon}
            </span>
          );
        }
      }

      // ⬇⬇ heading 자식에서 fontSize 마크 제거한 뒤 렌더링
      const safeChildren = (el.children ?? []).map((child: any, i: number) =>
        renderNode(
          stripFontSizeFromDescendants(child),
          key ? `${key}-${i}` : i
        )
      );

      const textContent = stripReact(safeChildren).trim();
      const id = toHeadingIdFromText(textContent);
      const level = node.type === "heading-one" ? 1 : node.type === "heading-two" ? 2 : 3;
      const fontSize = level === 1 ? "28px" : node.type === "heading-two" ? "22px" : "18px";
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;

      const justify =
        el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start';

      return (
        <Tag
          key={key}
          id={id}
          suppressHydrationWarning
          style={{
            fontSize,
            textAlign: el.textAlign || 'left',
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: justify,
            width: '100%'
          }}
        >
          {iconHtml}
          <span style={{ display: "inline" }}>{safeChildren}</span>
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
            <div key={key} style={{ width: "95%", margin: "32px auto", textAlign: "center" }}>
              <hr style={{ border: 0, borderTop: `4px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "shortbold":
          return (
            <div key={key} style={{ width: 82, margin: "34px auto", textAlign: "center" }}>
              <hr style={{ border: 0, borderTop: `5px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "dotted":
          return (
            <div key={key} style={{ width: "95%", margin: "28px auto", textAlign: "center" }}>
              <hr style={{ border: 0, borderTop: `2px dotted ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
        case "diamond":
          return (
            <div key={key} style={{ width: "100%", margin: "34px 0", textAlign: "center" }}>
              <span style={{ fontSize: 24, letterSpacing: 12, color: "#666" }}>◇───◇</span>
            </div>
          );
        case "diamonddot":
          return (
            <div key={key} style={{ width: "100%", margin: "32px 0", textAlign: "center" }}>
              <span style={{ fontSize: 22, letterSpacing: 6, color: "#666" }}>◇ ⋅ ⋅ ⋅ ◇</span>
            </div>
          );
        case "dotdot":
          return (
            <div key={key} style={{ width: "100%", margin: "30px 0", textAlign: "center" }}>
              <span style={{ fontSize: 28, letterSpacing: 8, color: borderColor }}>• • • • • • •</span>
            </div>
          );
        case "slash":
          return (
            <div key={key} style={{ width: "100%", margin: "30px 0", textAlign: "center" }}>
              <span style={{ fontSize: 30, letterSpacing: 14, color: borderColor }}>/  /  /</span>
            </div>
          );
        case "bar":
          return (
            <div key={key} style={{ width: "100%", margin: "28px 0", textAlign: "center" }}>
              <span style={{ fontSize: 22, color: borderColor }}>|</span>
            </div>
          );
        default:
          return (
            <div key={key} style={{ width: "95%", margin: "24px auto", textAlign: "center" }}>
              <hr style={{ border: 0, borderTop: `1.5px solid ${borderColor}`, width: "100%", margin: "0 auto" }} />
            </div>
          );
      }
    }

    // 링크 블록(박스형)
    case "link-block": {
      return <LinkBlockView node={node} keyProp={key ?? ''} />;
    }

    // 내부적으로도 사용되는 컨테이너
    case "link-block-row": {
      return (
        <div
          key={key}
          style={{
            display: 'flex',
            gap: 12,
            margin: '8px 0',
            width: '100%',
            flexWrap: 'wrap',
            alignItems: 'stretch'
          }}
        >
          {children}
        </div>
      );
    }

    case 'info-box': {
      const type = (node.boxType || 'info').toLowerCase();
      const { container, icon, role } = getInfoboxPreset(type);
      return (
        <div key={key} role={role} style={{ ...container, margin: '8px 0' }}>
          <span aria-hidden="true" style={icon as React.CSSProperties} />
          <div
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              lineHeight: 1.55,
              fontWeight: 560,
              color: '#1c1d1f'
            }}
          >
            {children}
          </div>
        </div>
      );
    }

    // 이미지 블록 (SmartImage로 최적화 + CDN/버전)
    case "image": {
      let justify: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (node.textAlign === 'left') justify = 'flex-start';
      else if (node.textAlign === 'right') justify = 'flex-end';

      const v = (node.updatedAt || node.version) as string | number | undefined;
      const src = withVersion(cdn(node.url), v);

      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <div key={key} style={{ margin: '16px 0' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: justify,
              alignItems: 'flex-start',
              minHeight: 40
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <SmartImage
                src={src}
                alt=""
                width={w}
                height={h}
                sizes="(max-width: 768px) 90vw, 60vw"
                rounded={10}
                style={{ boxShadow: '0 2px 12px 0 #0001', background: '#fff' }}
              />
            </div>
          </div>
        </div>
      );
    }

    // ⬇️ 영상 블록: 이미지와 동일한 정렬(textAlign) + CDN/버전 적용
    case "video": {
      let justify: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (node.textAlign === 'left') justify = 'flex-start';
      else if (node.textAlign === 'right') justify = 'flex-end';

      const v = (node.updatedAt || node.version) as string | number | undefined;
      const src = withVersion(cdn(node.url), v);

      const w = node.width ? Number(node.width) : undefined;
      const h = node.height ? Number(node.height) : undefined;

      return (
        <div key={key} style={{ margin: '16px 0' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: justify,
              alignItems: 'flex-start',
              minHeight: 40
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <video
                src={src}
                controls
                playsInline
                preload="metadata"
                style={{
                  maxWidth: w ? `${w}px` : '90%',
                  height: h ? `${h}px` : 'auto',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px 0 #0001',
                  background: '#000',
                  display: 'block'
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
            borderRadius: 4
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
            verticalAlign: "middle"
          }}
        >
          {node.icon}
        </span>
      );

    case "price-table-card": {
      if (!Array.isArray(node.items)) return <div key={key}></div>;
      return <PriceTableCardBlock node={node} keyProp={key ?? ''} />;
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
  // 기존 stripReact 구현 그대로 유지
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(stripReact).join("");
  if (React.isValidElement(node)) return stripReact(node.props.children);
  return "";
}