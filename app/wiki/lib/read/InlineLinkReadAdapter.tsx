'use client';

import React from 'react';

import InlineWikiLink from '@/components/wiki-render/link/InlineWikiLink';
import InlineLinkRenderer from '@/components/wiki-render/link/InlineLinkRenderer';

import {
  isInternalWikiHref as sharedIsInternalWikiHref,
} from '@/components/wiki-render/link/linkUtils';

type InlineLinkReadAdapterProps = {
  node: any;
  children: React.ReactNode;
  onWikiNavigate?: (href: string) => void;
};

export default function InlineLinkReadAdapter({
  node,
  children,
  onWikiNavigate,
}: InlineLinkReadAdapterProps) {
  const href = String(node.url ?? node.href ?? '').trim();
  const isInternalWikiLink = href ? sharedIsInternalWikiHref(href) : false;

  if (isInternalWikiLink) {
    return (
      <InlineWikiLink
        href={href}
        onWikiNavigate={onWikiNavigate}
      >
        {children}
      </InlineWikiLink>
    );
  }

  return (
    <InlineLinkRenderer
      mode="read"
      href={href || '#'}
      attributes={{
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }}
    >
      {children}
    </InlineLinkRenderer>
  );
}