// =============================================
// File: app/wiki/lib/WikiReadRenderer.tsx
// =============================================
/**
 * Slate JSON(Descendant[])을 React JSX로 렌더링하는 컴포넌트
 * - renderSlateToHtml.ts 기능 100% 커버
 * - heading, info-box, divider, 링크, 이미지, 인라인마크, price-table-card 등 지원
 */

import React, { useState } from "react";
import { Descendant, Text } from "slate";


function toHeadingIdFromText(text: string) {
  const cleaned = text.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();
  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;
  return `heading-${slug}`;
}

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

  // 타입별 컬러/아이콘
  const map: Record<
    string,
    { bg: string; bd: string; accent: string; mask: string; role: 'note' | 'alert' }
  > = {
    info: {
      bg: '#f2f6ff',
      bd: '#dbeafe',
      accent: '#2563eb',
      // 파란 박스는 "i" 아이콘
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

  // mask-* 속성은 React 타입이 빡세서 any와 함께 Webkit 접두사도 같이 지정
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

// 메인 렌더 컴포넌트
export default function WikiReadRenderer({ content }: { content: Descendant[] }) {
  return (
    <>
      {content.map((node, idx) => renderNode(node, idx))}
    </>
  );
}

function PriceTableCardBlock({ node, keyProp }: { node: any; keyProp: React.Key }) {
  const [indexes, setIndexes] = useState<number[]>(() =>
    node.items.map(() => 0)
  );
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
          const stages: string[] = item.stages || ["가격"];
          const prices: number[] =
            Array.isArray(item.prices) && item.prices.length
              ? item.prices
              : Array(stages.length).fill(0);

          const cardIdx = indexes[idx] ?? 0;
          const stage = stages[cardIdx] || "";
          const price = prices[cardIdx] ?? 0;
          const badgeColor = getPriceBadgeColor(stage, item.colorType);

          const name = item.name?.trim() ? item.name : "이름 없음";

          const image =
            item.image
              ? (
                <img
                  src={item.image}
                  alt=""
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
                ></span>
              );

          // 뱃지(옵션 많으면 출력)
          const badge = stages.length > 1 ? (
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

          // 화살표: 호버 시만
          const showArrows = hovered === idx && stages.length > 1;
          const leftArrowBtn = showArrows && (
            <button
              key="left"
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
          );
          const rightArrowBtn = showArrows && (
            <button
              key="right"
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
          );

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
              {leftArrowBtn}
              {rightArrowBtn}
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
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 17,
                  marginBottom: 0,
                  color: item.name ? "#333" : "#bbb",
                  textAlign: "center",
                  minHeight: 24,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: "#5b80f5",
                  textAlign: "center",
                  letterSpacing: "1px",
                  marginTop: 3,
                  borderRadius: 8,
                  padding: "2px 10px",
                  minHeight: 28
                }}
              >
                {price}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 뱃지 컬러 함수 (renderSlateToHtml과 1:1 동일)
function getPriceBadgeColor(stage: string, type?: string) {
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

// 텍스트 노드 처리 (bold, italic, underline 등 마크/스타일 모두 적용)
function renderLeaf(node: any, key?: React.Key): React.ReactNode {
  let children = node.text;
  // 마크
  if (node.bold) children = <strong>{children}</strong>;
  if (node.italic) children = <em>{children}</em>;
  if (node.underline) children = <u>{children}</u>;
  if (node.strikethrough) children = <s>{children}</s>;

  // 스타일
  const style: React.CSSProperties = {};
  if (node.color) style.color = node.color;
  if (node.backgroundColor) style.backgroundColor = node.backgroundColor;
  if (node.fontSize) style.fontSize = node.fontSize;

  if (Object.keys(style).length > 0)
    return (
      <span key={key} style={style}>
        {children}
      </span>
    );
  else return <span key={key}>{children}</span>;
}

// 노드 타입별 렌더링 함수 (재귀)
function renderNode(node: any, key?: React.Key): React.ReactNode {
  // 텍스트(leaf)
  if (Text.isText(node)) {
    return renderLeaf(node, key);
  }

  // children 재귀
  const children = node.children?.map((n: any, i: number) => renderNode(n, key ? `${key}-${i}` : i));

  // 블럭별 분기
  switch (node.type) {
    case "paragraph": {
      // 들여쓰기 라인 지원
      const indentLine = node.indentLine;
      const style: React.CSSProperties = {};
      if (indentLine) {
        style.borderLeft = "4px solid #aaa";
        style.borderRadius = 0;
        style.paddingLeft = 16;
        style.minHeight = "1.6em";
      }
      return (
        <p key={key} style={style}>
          {children}
        </p>
      );
    }

    // heading(제목) - 아이콘/이미지/슬러그/스타일 동일
    case "heading-one":
    case "heading-two":
    case "heading-three": {
      const el = node;
      let iconHtml: React.ReactNode = null;
      if (el.icon) {
        if (typeof el.icon === "string" && el.icon.startsWith("http")) {
          iconHtml = (
            <img
              src={el.icon}
              alt="icon"
              style={{
                width: "2.5em",
                height: "2.5em",
                verticalAlign: "middle",
                marginRight: 10,
                objectFit: "contain",
                display: "inline-block"
              }}
            />
          );
        } else {
          iconHtml = (
            <span style={{ fontSize: "1.3em", marginRight: 10, display: "inline-block" }}>{el.icon}</span>
          );
        }
      }
      // heading에 들어가는 순수 텍스트만 추출
      const textContent = stripReact(children).trim();
      const id = toHeadingIdFromText(textContent);
      const level =
        node.type === "heading-one"
          ? 1
          : node.type === "heading-two"
          ? 2
          : 3;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;

      return (
        <Tag
          key={key}
          id={id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7
          }}
        >
          {iconHtml}
          <span style={{ fontSize: 30, fontWeight: "bold" }}>{children}</span>
        </Tag>
      );
    }

    // 링크
    case "link":
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );

    // 구분선(divider)
    case "divider": {
      const borderColor = "#e0e0e0";
      switch (node.style) {
        case "bold":
          return (
            <div
              key={key}
              style={{
                width: "70%",
                margin: "32px auto",
                textAlign: "center"
              }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `4px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto"
                }}
              />
            </div>
          );
        case "shortbold":
          return (
            <div
              key={key}
              style={{
                width: 82,
                margin: "34px auto",
                textAlign: "center"
              }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `5px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto"
                }}
              />
            </div>
          );
        case "dotted":
          return (
            <div key={key} style={{ width: "70%", margin: "28px auto", textAlign: "center" }}>
              <hr
                style={{
                  border: 0,
                  borderTop: `2px dotted ${borderColor}`,
                  width: "100%",
                  margin: "0 auto"
                }}
              />
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
            <div
              key={key}
              style={{ width: "70%", margin: "24px auto", textAlign: "center" }}
            >
              <hr
                style={{
                  border: 0,
                  borderTop: `1.5px solid ${borderColor}`,
                  width: "100%",
                  margin: "0 auto"
                }}
              />
            </div>
          );
      }
    }

    // 링크 블록(박스형)
    case "link-block": {
      const icon = node.favicon ? (
        <img
          src={node.favicon}
          alt="favicon"
          style={{ width: 24, height: 24, marginRight: 8 }}
        />
      ) : null;
      return (
        <div
          key={key}
          contentEditable={false}
          style={{
            display: "flex",
            alignItems: "center",
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 6,
            marginBottom: 8
          }}
        >
          {icon}
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#0070f3",
              textDecoration: "none",
              flexGrow: 1
            }}
          >
            {node.sitename || node.url}
          </a>
        </div>
      );
    }

    // info-box(정보/주의/경고)
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

    // 이미지 블록
    case "image": {
      let alignStyle: React.CSSProperties = {};
      if (node.textAlign === "left") alignStyle = { float: "left", marginRight: 18 };
      if (node.textAlign === "right") alignStyle = { float: "right", marginLeft: 18 };
      if (node.textAlign === "center")
        alignStyle = { display: "block", marginLeft: "auto", marginRight: "auto" };

      return (
        <img
          key={key}
          src={node.url}
          alt=""
          style={{
            maxWidth: "100%",
            marginTop: 12,
            marginBottom: 12,
            ...alignStyle
          }}
        />
      );
    }

    // 인라인 이미지
    case "inline-image":
      return (
        <img
          key={key}
          src={node.url}
          alt=""
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

    // 인라인 마크 (아이콘/색상/굵기)
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

    // 시세표 블럭(price-table-card)
    case "price-table-card": {
      if (!Array.isArray(node.items)) return <div key={key}></div>;
      return <PriceTableCardBlock node={node} keyProp={key ?? ''} />;
    }

    // 지원하지 않는 타입
    default:
      return (
        <div key={key}>
          {children}
        </div>
      );
  }
}

// React Node의 텍스트만 추출하는 유틸 (heading 슬러그용)
function stripReact(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(stripReact).join("");
  if (React.isValidElement(node)) return stripReact(node.props.children);
  return "";
}
