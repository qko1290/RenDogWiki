'use client';

import React from 'react';

import SmartImage from '@/components/common/SmartImage';
import MediaBlock from '@/components/wiki-render/blocks/MediaBlock';
import { cdn, withVersion } from '@lib/cdn';

type MediaReadAdapterProps = {
  node: any;
};

function getVersion(node: any): string | number | undefined {
  return (node?.updatedAt || node?.version) as string | number | undefined;
}

function getSize(value: unknown): number | undefined {
  if (value == null) return undefined;

  const n = Number(value);

  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function ImageReadAdapter({ node }: MediaReadAdapterProps) {
  const src = withVersion(cdn(node.url), getVersion(node));
  const width = getSize(node.width);
  const height = getSize(node.height);

  return (
    <MediaBlock
      mode="read"
      kind="image"
      src={src}
      alt={node.alt || ''}
      textAlign={node.textAlign}
      width={width}
      height={height}
      renderImage={({ src, alt, width, height, style, className }) => (
        <SmartImage
          src={src}
          alt={alt || ''}
          width={width ?? 960}
          height={height ?? 540}
          className={className}
          loading="lazy"
          decoding="async"
          style={style}
        />
      )}
    />
  );
}

export function VideoReadAdapter({ node }: MediaReadAdapterProps) {
  const src = withVersion(cdn(node.url), getVersion(node));
  const width = getSize(node.width);
  const height = getSize(node.height);

  return (
    <MediaBlock
      mode="read"
      kind="video"
      src={src}
      textAlign={node.textAlign}
      width={width}
      height={height}
    />
  );
}