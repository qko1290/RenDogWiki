'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import LinkCardRenderer from '@/components/wiki-render/link/LinkCardRenderer';
import {
  isRdwikiWikiUrl,
  parseLinkUrl,
} from '@/components/wiki-render/link/linkUtils';
import useResolvedWikiDocIcon from '@/components/wiki-render/link/useResolvedWikiDocIcon';
import { markNextDocViewSource } from '@/wiki/lib/viewSource';

type LinkCardInputSize =
  | 'small'
  | 'large'
  | 'half'
  | 'full'
  | 'normal'
  | null
  | undefined;

type LinkCardReadAdapterProps = {
  url?: string;
  isWiki?: boolean;
  wikiPath?: string | number | null;
  wikiTitle?: string | null;
  sitename?: string | null;
  size?: LinkCardInputSize;
  docIcon?: string | null;
  labelText?: string;
  inRow?: boolean;
  compactMobile?: boolean;
  onWikiNavigate?: (href: string) => void;
  children?: React.ReactNode;
};

export default function LinkCardReadAdapter({
  url,
  isWiki,
  wikiPath,
  wikiTitle,
  sitename,
  size,
  docIcon,
  labelText,
  inRow,
  compactMobile,
  onWikiNavigate,
  children,
}: LinkCardReadAdapterProps) {
  const router = useRouter();

  const parsedUrl = React.useMemo(
    () => parseLinkUrl(url),
    [url],
  );

  const isWikiLink = React.useMemo(() => {
    if (isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [isWiki, parsedUrl]);

  const resolvedDocIcon = useResolvedWikiDocIcon({
    href: url,
    isWikiLink,
    fallbackIcon: docIcon,
  });

  const handleWikiNavigate = React.useCallback(
    (href: string) => {
      markNextDocViewSource('link');

      if (onWikiNavigate) {
        onWikiNavigate(href);
        return;
      }

      router.push(href);
    },
    [onWikiNavigate, router],
  );

  return (
    <LinkCardRenderer
      mode="read"
      url={url}
      isWiki={isWikiLink}
      wikiPath={wikiPath}
      wikiTitle={wikiTitle}
      sitename={sitename}
      size={size}
      docIcon={resolvedDocIcon}
      labelText={labelText}
      inRow={inRow}
      compactMobile={compactMobile}
      onWikiNavigate={handleWikiNavigate}
      clickableInReadMode
    >
      {children}
    </LinkCardRenderer>
  );
}