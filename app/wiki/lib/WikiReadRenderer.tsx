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

import {
  ImageReadAdapter,
  VideoReadAdapter,
} from './read/MediaReadAdapter';

import {
  TableCellReadAdapter,
  TableReadAdapter,
  TableRowReadAdapter,
} from './read/TableReadAdapter';

import {
  LinkBlockReadAdapter,
  LinkBlockRowReadAdapter,
} from './read/LinkBlockReadAdapter';

import {
  DividerReadAdapter,
  InfoBoxReadAdapter,
  ParagraphReadAdapter,
} from './read/BasicBlockReadAdapters';

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
        <LinkBlockRowReadAdapter
          key={`link-row-${i}`}
          node={{
            type: 'link-block-row',
            children: [a, b],
          }}
          keyProp={`link-row-${i}`}
          ctx={ctx}
          handlers={handlers}
          env={{
            isMobile,
            isDarkMode,
            onWikiNavigate,
          }}
          renderNode={renderNode}
        />,
      );

      i += 1;
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
      return (
        <ParagraphReadAdapter
          node={node}
          env={env}
        >
          {children}
        </ParagraphReadAdapter>
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
      return <DividerReadAdapter node={node} />;
    }

    case "link-block": {
      return (
        <LinkBlockReadAdapter
          node={node}
          env={env}
        >
          {children}
        </LinkBlockReadAdapter>
      );
    }

    case "link-block-row": {
      return (
        <LinkBlockRowReadAdapter
          node={node}
          keyProp={key}
          ctx={ctx}
          handlers={handlers}
          env={env}
          renderNode={renderNode}
        />
      );
    }

    case "info-box": {
      return (
        <InfoBoxReadAdapter
          node={node}
          keyProp={key}
          ctx={ctx}
          handlers={handlers}
          env={env}
          renderNode={renderNode}
        />
      );
    }

    // 이미지 블록 (SmartImage로 최적화 + CDN/버전)
    case "image": {
      return <ImageReadAdapter node={node} />;
    }

    // 영상 블록: 이미지와 동일한 정렬(textAlign) + CDN/버전 적용
    case "video": {
      return <VideoReadAdapter node={node} />;
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
      return (
        <TableReadAdapter node={node}>
          {children}
        </TableReadAdapter>
      );
    }

    case "table-row": {
      return (
        <TableRowReadAdapter>
          {children}
        </TableRowReadAdapter>
      );
    }

    case "table-cell": {
      return (
        <TableCellReadAdapter
          node={node}
          keyProp={key}
          ctx={ctx}
          handlers={handlers}
          env={env}
          renderNode={renderNode}
        />
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