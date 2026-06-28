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

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const hash = anchorId ? `#${anchorId}` : '';

    const url =
      typeof window !== 'undefined'
        ? (() => {
            const u = new URL(window.location.href);

            const title = u.searchParams.get('title');

            if (title) {
              u.searchParams.set(
                'title',
                encodeTitleForShare(decodeTitleForDisplay(title)),
              );
            }

            return `${u.origin}${u.pathname}?${u.searchParams.toString()}${hash}`;
          })()
        : hash;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      if (typeof window !== 'undefined' && hash) {
        window.location.hash = hash;
      }
    }
  };

  return (
    <button
      type="button"
      aria-label="제목 링크 복사"
      title="제목 링크 복사"
      onClick={handleClick}
      style={{
        marginLeft: 8,
        border: 'none',
        background: 'transparent',
        color: 'var(--muted)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        padding: '2px 4px',
        opacity: copied ? 1 : 0.65,
      }}
    >
      {copied ? '✔' : '#'}
    </button>
  );
}