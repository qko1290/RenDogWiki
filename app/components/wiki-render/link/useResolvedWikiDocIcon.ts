'use client';

import React from 'react';

import {
  getWikiDocDetailByHref,
} from './wikiDocDetailService';
import { normalizeToAppHref } from './linkUtils';

type UseResolvedWikiDocIconOptions = {
  href?: string | null;
  isWikiLink: boolean;
  fallbackIcon?: string | null;
};

function normalizeHeadingId(value: unknown) {
  const text = String(value ?? '').trim();

  if (!text) return '';
  return text.startsWith('heading-') ? text : `heading-${text}`;
}

export default function useResolvedWikiDocIcon({
  href,
  isWikiLink,
  fallbackIcon,
}: UseResolvedWikiDocIconOptions) {
  const normalizedHref = React.useMemo(
    () => normalizeToAppHref(href || '#'),
    [href],
  );

  const normalizedFallbackIcon =
    String(fallbackIcon ?? '').trim() || null;

  const [resolvedDocIcon, setResolvedDocIcon] =
    React.useState<string | null>(normalizedFallbackIcon);

  React.useEffect(() => {
    let cancelled = false;

    setResolvedDocIcon(normalizedFallbackIcon);

    if (!isWikiLink) {
      return () => {
        cancelled = true;
      };
    }

    if (!normalizedHref || normalizedHref === '#') {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const loaded = await getWikiDocDetailByHref(normalizedHref);

        if (!loaded || cancelled) return;

        const { parsed, detail } = loaded;

        let iconCandidate: string | null = null;

        const targetHash = normalizeHeadingId(parsed.hash);

        if (
          targetHash &&
          Array.isArray(detail.headings)
        ) {
          const matchedHeading = detail.headings.find((heading) => {
            const headingId = normalizeHeadingId(heading.id);

            return headingId === targetHash;
          });

          if (matchedHeading?.icon) {
            iconCandidate =
              String(matchedHeading.icon).trim() || null;
          }
        }

        if (!iconCandidate && detail.icon) {
          iconCandidate =
            String(detail.icon).trim() || null;
        }

        if (!cancelled && iconCandidate) {
          setResolvedDocIcon(iconCandidate);
        }
      } catch {
        // 문서 정보 조회 실패 시 저장된 아이콘을 그대로 유지한다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isWikiLink,
    normalizedFallbackIcon,
    normalizedHref,
  ]);

  return resolvedDocIcon;
}