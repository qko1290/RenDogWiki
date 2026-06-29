'use client';

import React from 'react';

import {
  decodeTitleForDisplay,
  encodeTitleForShare,
} from '../readRendererUtils';

type HeadingAnchorButtonProps = {
  anchorId: string;
};

export default function HeadingAnchorButton({
  anchorId,
}: HeadingAnchorButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.blur();

    if (!anchorId) return;

    const hash = `#${anchorId}`;

    const url =
      typeof window !== 'undefined'
        ? (() => {
            const currentUrl = new URL(window.location.href);

            const title = currentUrl.searchParams.get('title');

            if (title) {
              currentUrl.searchParams.set(
                'title',
                encodeTitleForShare(decodeTitleForDisplay(title)),
              );
            }

            return `${currentUrl.origin}${currentUrl.pathname}?${currentUrl.searchParams.toString()}${hash}`;
          })()
        : hash;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      if (typeof window !== 'undefined' && hash) {
        window.location.hash = hash;
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="wiki-heading-anchor-btn"
      aria-label="이 제목 링크 복사"
    >
      <span
        className={
          'wiki-heading-anchor-pill' +
          (copied ? ' wiki-heading-anchor-pill--copied' : '')
        }
      >
        {copied ? '✔' : ''}
      </span>
    </button>
  );
}