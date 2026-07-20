'use client';

import React from 'react';

import SmartImage from '@/components/common/SmartImage';
import {
  MediaBlock,
} from '@/components/wiki-render';
import {
  resolveMediaNode,
} from '@/components/wiki-render/blocks/mediaNodeUtils';

import {
  cdn,
  withVersion,
} from '@lib/cdn';

type MediaReadAdapterProps = {
  node: any;
};

export function ImageReadAdapter({
  node,
}: MediaReadAdapterProps) {
  const media =
    resolveMediaNode(node);

  const src = withVersion(
    cdn(media.rawSrc),
    media.version,
  );

  return (
    <MediaBlock
      mode="read"
      kind="image"
      src={src}
      alt={media.alt}
      textAlign={media.textAlign}
      width={media.width}
      height={media.height}
      renderImage={({
        src: imageSrc,
        alt,
        width,
        height,
        style,
        className,
      }) => (
        <SmartImage
          src={imageSrc}
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

export function VideoReadAdapter({
  node,
}: MediaReadAdapterProps) {
  const media =
    resolveMediaNode(node);

  const src = withVersion(
    cdn(media.rawSrc),
    media.version,
  );

  return (
    <MediaBlock
      mode="read"
      kind="video"
      src={src}
      textAlign={media.textAlign}
      width={media.width}
      height={media.height}
    />
  );
}