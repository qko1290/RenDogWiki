'use client';

import React from 'react';

import LinkBlockRow from '@/components/wiki-render/blocks/LinkBlockRow';

import LinkCardReadAdapter from './link/LinkCardReadAdapter';
import { nodeToPlainText } from '../readRendererUtils';
import type {
  ReadRenderEnv,
  ReadRenderNode,
} from './types';

type LinkBlockReadAdapterProps = {
  node: any;
  children?: React.ReactNode;
  env?: ReadRenderEnv;
};

export function LinkBlockReadAdapter({
  node,
  children,
  env,
}: LinkBlockReadAdapterProps) {
  const labelText = nodeToPlainText(node.children);

  return (
    <LinkCardReadAdapter
      url={node.url}
      isWiki={node.isWiki}
      wikiPath={node.wikiPath}
      wikiTitle={node.wikiTitle}
      sitename={node.sitename}
      size={node.size}
      docIcon={node.docIcon}
      labelText={labelText}
      inRow={Boolean(env?.inLinkBlockRow)}
      compactMobile={Boolean(env?.isMobile)}
      onWikiNavigate={env?.onWikiNavigate}
    >
      {children}
    </LinkCardReadAdapter>
  );
}

type LinkBlockRowReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  ctx?: any;
  handlers?: any;
  env?: ReadRenderEnv;
  renderNode: ReadRenderNode;
};

export function LinkBlockRowReadAdapter({
  node,
  keyProp,
  ctx,
  handlers,
  env,
  renderNode,
}: LinkBlockRowReadAdapterProps) {
  const children = Array.isArray(node.children)
    ? node.children
    : [];

  return (
    <LinkBlockRow>
      {children.map((child: any, index: number) =>
        renderNode(
          child,
          keyProp ? `${keyProp}-${index}` : index,
          ctx,
          handlers,
          {
            ...env,
            inLinkBlockRow: true,
          },
        ),
      )}
    </LinkBlockRow>
  );
}