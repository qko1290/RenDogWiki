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
  useEffect,
  useState,
  useRef,
} from "react";
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

import {
  compactReadContent,
  decodeTitleForDisplay,
  encodeTitleForShare,
  flexJustifyFromAlign,
  getCurrentThemeIsDark,
  nodeToPlainText,
  normalizeInfoBoxNodeForMobile,
  stripFontSizeFromDescendants,
  stripReact,
  toHeadingIdFromText,
} from './readRendererUtils';

import FootnoteReadAdapter from './read/FootnoteReadAdapter';

import HeadingAnchorButton from './read/HeadingAnchorButton';

type Props = {
  content: Descendant[];
  readOnly?: boolean;
  onWikiRefClick?: (kind: WikiRefKind, id: number) => void | Promise<void>;
  onWikiNavigate?: (href: string) => void;
};

/** heading 링크 복사용 컨텍스트 */
type HeadingCopyCtx = {
  headingOccRef: React.MutableRefObject<Map<string, number>>;
};

/** 읽기 전용 렌더러에서 위키 참조 클릭을 상위로 전달하기 위한 핸들러 */
type WikiRefHandlers = {
  readOnly?: boolean;
  onWikiRefClick?: (kind: any, id: number) => void;
};

// 메인 렌더 컴포넌트
export default function WikiReadRenderer({
  content,
  readOnly = true,
  onWikiRefClick,
  onWikiNavigate,
}: Props) {

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

  const ctx: HeadingCopyCtx = {
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

      /**
       * main 원본 동작:
       * heading 내부 텍스트에 남아있는 fontSize mark는 제거하고,
       * heading 자체 크기(h1/h2/h3)를 우선 적용한다.
       */
      const safeChildren = (el.children ?? []).map((child: any, i: number) =>
        renderNode(
          stripFontSizeFromDescendants(child),
          key ? `${key}-${i}` : i,
          ctx,
          handlers,
          env,
        ),
      );

      const textContent = stripReact(safeChildren).trim();
      const baseId = toHeadingIdFromText(textContent);

      const occ = ctx?.headingOccRef.current.get(baseId) ?? 0;
      ctx?.headingOccRef.current.set(baseId, occ + 1);

      const domId = `${baseId}--${occ}`;

      const level =
        node.type === "heading-one"
          ? 1
          : node.type === "heading-two"
            ? 2
            : 3;

      return (
        <HeadingBlock
          key={key}
          mode="read"
          level={level}
          textAlign={el.textAlign}
          icon={el.icon}
          domId={domId}
          dataHeadingId={baseId}
        >
          {safeChildren}

          <HeadingAnchorButton anchorId={baseId} />
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
      return (
        <FootnoteReadAdapter
          label={(node as any).label}
          content={(node as any).content}
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