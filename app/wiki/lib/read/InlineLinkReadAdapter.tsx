'use client';

import React from 'react';

import {
  InlineLinkRenderer,
} from '@/components/wiki-render';
import {
  isInternalWikiHref as sharedIsInternalWikiHref,
} from '@/components/wiki-render/link/linkUtils';

import InlineWikiLinkRead from './link/InlineWikiLinkRead';

type InlineLinkReadAdapterProps = {
  node: any;
  children: React.ReactNode;
  onWikiNavigate?: (
    href: string,
  ) => void;
};

export default function InlineLinkReadAdapter({
  node,
  children,
  onWikiNavigate,
}: InlineLinkReadAdapterProps) {
  const href = String(
    node?.url ??
      node?.href ??
      '',
  ).trim();

  const isInternalWikiLink =
    href
      ? sharedIsInternalWikiHref(
          href,
        )
      : false;

  if (isInternalWikiLink) {
    return (
      <InlineWikiLinkRead
        href={href}
        onWikiNavigate={
          onWikiNavigate
        }
      >
        {children}
      </InlineWikiLinkRead>
    );
  }

  return (
    <InlineLinkRenderer
      mode="read"
      href={href || '#'}
      attributes={{
        target: '_blank',
        rel:
          'noopener noreferrer nofollow',
      }}
    >
      {children}
    </InlineLinkRenderer>
  );
}