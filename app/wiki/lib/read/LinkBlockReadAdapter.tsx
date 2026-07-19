'use client';

import React from 'react';

import LinkCardRenderer from '@/components/wiki-render/link/LinkCardRenderer';
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
    <LinkCardRenderer
      mode="read"
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
      clickableInReadMode
    >
      {children}
    </LinkCardRenderer>
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
  const children = Array.isArray(node.children) ? node.children : [];

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        margin: '8px 0',
        width: '100%',
        flexWrap: 'wrap',
        alignItems: 'stretch',
      }}
    >
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
    </div>
  );
}