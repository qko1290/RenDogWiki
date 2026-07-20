'use client';

import React from 'react';

import {
  isRdwikiWikiUrl,
  parseLinkUrl,
} from './linkUtils';

type UseLinkCardTargetOptions = {
  url?: string | null;
  isWiki?: boolean;
};

type UseLinkCardTargetResult = {
  parsedUrl: URL | null;
  isWikiLink: boolean;
};

export default function useLinkCardTarget({
  url,
  isWiki,
}: UseLinkCardTargetOptions): UseLinkCardTargetResult {
  const parsedUrl = React.useMemo(
    () => parseLinkUrl(url),
    [url],
  );

  const isWikiLink = React.useMemo(() => {
    if (isWiki) {
      return true;
    }

    if (!parsedUrl) {
      return false;
    }

    return isRdwikiWikiUrl(parsedUrl);
  }, [
    isWiki,
    parsedUrl,
  ]);

  return {
    parsedUrl,
    isWikiLink,
  };
}