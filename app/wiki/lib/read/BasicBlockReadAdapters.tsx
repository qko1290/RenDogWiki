'use client';

import React from 'react';

import DividerBlock from '@/components/wiki-render/blocks/DividerBlock';
import ParagraphBlock from '@/components/wiki-render/blocks/ParagraphBlock';
import InfoBoxBlock from '@/components/wiki-render/blocks/InfoBoxBlock';

import {
  normalizeInfoBoxNodeForMobile,
  stripReact,
} from '../readRendererUtils';

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
  ctx?: any,
  handlers?: any,
  env?: ReadRenderEnv,
) => React.ReactNode;

type ParagraphReadAdapterProps = {
  node: any;
  children: React.ReactNode;
  env?: ReadRenderEnv;
};

export function ParagraphReadAdapter({
  node,
  children,
  env,
}: ParagraphReadAdapterProps) {
  const plainText = stripReact(children).replace(/\u200B/g, '').trim();
  const isMobileTableText = Boolean(env?.isMobile && env?.inTableCell);

  return (
    <ParagraphBlock
      mode="read"
      textAlign={node.textAlign}
      indentLine={Boolean(node.indentLine)}
      plainText={plainText}
      isEmpty={plainText.length === 0}
      isMobileTableText={isMobileTableText}
    >
      {children}
    </ParagraphBlock>
  );
}

type DividerReadAdapterProps = {
  node: any;
};

export function DividerReadAdapter({ node }: DividerReadAdapterProps) {
  return (
    <DividerBlock
      mode="read"
      styleType={node.style || 'default'}
    />
  );
}

type InfoBoxReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  ctx?: any;
  handlers?: any;
  env?: ReadRenderEnv;
  renderNode: RenderNodeFn;
};

export function InfoBoxReadAdapter({
  node,
  keyProp,
  ctx,
  handlers,
  env,
  renderNode,
}: InfoBoxReadAdapterProps) {
  const tone =
    node.boxType ??
    node.variant ??
    node.tone ??
    node.infoType ??
    'note';

  const sourceChildren = env?.isMobile
    ? (node.children ?? []).map(normalizeInfoBoxNodeForMobile)
    : node.children ?? [];

  const infoChildren = sourceChildren.map((child: any, index: number) =>
    renderNode(
      child,
      keyProp ? `${keyProp}-info-${index}` : index,
      ctx,
      handlers,
      env,
    ),
  );

  return (
    <InfoBoxBlock
      mode="read"
      tone={tone}
      noIcon={Boolean(node.noIcon)}
    >
      {infoChildren}
    </InfoBoxBlock>
  );
}