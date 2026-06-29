'use client';

import React from 'react';

import HeadingBlock from '@/components/wiki-render/blocks/HeadingBlock';

import HeadingAnchorButton from './HeadingAnchorButton';

import {
  stripFontSizeFromDescendants,
  stripReact,
  toHeadingIdFromText,
} from '../readRendererUtils';

type HeadingCopyCtx = {
  headingOccRef: React.MutableRefObject<Map<string, number>>;
};

type ReadRenderEnv = {
  isMobile?: boolean;
  isDarkMode?: boolean;
  inDarkTableCell?: boolean;
  inTableCell?: boolean;
  inLinkBlockRow?: boolean;
  onWikiNavigate?: (href: string) => void;
};

type RenderNodeFn = (
  node: any,
  key?: React.Key,
  ctx?: HeadingCopyCtx,
  handlers?: any,
  env?: ReadRenderEnv,
) => React.ReactNode;

type HeadingReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  ctx?: HeadingCopyCtx;
  handlers?: any;
  env?: ReadRenderEnv;
  renderNode: RenderNodeFn;
};

function getHeadingLevel(type: string): 1 | 2 | 3 {
  if (type === 'heading-one') return 1;
  if (type === 'heading-two') return 2;
  return 3;
}

export default function HeadingReadAdapter({
  node,
  keyProp,
  ctx,
  handlers,
  env,
  renderNode,
}: HeadingReadAdapterProps) {
  /**
   * main 원본 동작 유지:
   * heading 안의 fontSize mark는 제거하고,
   * HeadingBlock의 h1/h2/h3 크기를 우선 적용한다.
   */
  const safeChildren = (node.children ?? []).map((child: any, index: number) =>
    renderNode(
      stripFontSizeFromDescendants(child),
      keyProp ? `${keyProp}-${index}` : index,
      ctx,
      handlers,
      env,
    ),
  );

  const textContent = stripReact(safeChildren).trim();
  const baseId = toHeadingIdFromText(textContent);

  const occurrence = ctx?.headingOccRef.current.get(baseId) ?? 0;
  ctx?.headingOccRef.current.set(baseId, occurrence + 1);

  const domId = `${baseId}--${occurrence}`;

  return (
    <HeadingBlock
      mode="read"
      level={getHeadingLevel(node.type)}
      textAlign={node.textAlign}
      icon={node.icon}
      domId={domId}
      dataHeadingId={baseId}
    >
      {safeChildren}

      <HeadingAnchorButton anchorId={baseId} />
    </HeadingBlock>
  );
}