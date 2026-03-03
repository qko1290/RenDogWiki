// File: app/components/common/SmartImage.tsx
'use client';

import React, { CSSProperties } from 'react';
import Image, { type ImageProps } from 'next/image';
import { toProxyUrl } from '@lib/cdn';

type Props = Omit<ImageProps, 'src'> & {
  src: string;
  rounded?: number | string;
  unoptimized?: boolean;
};

export default function SmartImage({
  src,
  rounded,
  style,
  unoptimized,
  sizes,
  width,
  height,
  loading,
  fill,
  quality,
  ...rest
}: Props) {
  const proxied = toProxyUrl(src);

  const wNum = typeof width === 'number' ? width : null;
  const hNum = typeof height === 'number' ? height : null;

  // ✅ 규칙: max <= 128이면 아이콘
  const isIcon = wNum !== null && hNum !== null && Math.max(wNum, hNum) <= 128;

  // ✅ 아이콘이면 무조건 최적화 OFF
  const finalUnoptimized = isIcon ? true : !!unoptimized;

  // ✅ 본문 사이즈 기본값 (너 위키 본문 폭이 더 크면 여기만 올리면 됨)
  const CONTENT_MAX_PX = 960;

  // ✅ 아이콘 sizes는 px 고정(= w 다양화 방지)
  const computedSizesForIcon =
    wNum !== null && hNum !== null ? `${Math.max(wNum, hNum)}px` : '128px';

  // ✅ 본문 sizes는 “모바일 100vw + 데스크탑 상한”으로 타이트하게
  const computedSizesForContent = (() => {
    // fill이면 컨테이너 폭에 종속되므로 100vw + 상한
    if (fill) return `(max-width: 768px) 100vw, ${CONTENT_MAX_PX}px`;

    const desktopPx = wNum !== null ? Math.min(wNum, CONTENT_MAX_PX) : CONTENT_MAX_PX;

    // 더 타이트: 태블릿 구간도 한 번 더 끊어서 w 변형을 줄임
    return `(max-width: 640px) 100vw, (max-width: 1200px) ${desktopPx}px, ${desktopPx}px`;
  })();

  const finalSizes = isIcon
    ? (sizes ?? computedSizesForIcon)
    : (sizes ?? computedSizesForContent);

  const mergedStyle: CSSProperties = {
    ...style,
    ...(rounded !== undefined
      ? { borderRadius: typeof rounded === 'number' ? `${rounded}px` : rounded }
      : {}),
  };

  // ✅ 안전장치: quality 기본값 고정 (요청 파라미터 다양화 감소)
  // - 아이콘은 unoptimized라 영향 없음
  const finalQuality = quality ?? 75;

  return (
    <Image
      {...rest}
      src={proxied}
      width={width}
      height={height}
      fill={fill}
      sizes={finalSizes}
      unoptimized={finalUnoptimized}
      quality={finalQuality}
      style={mergedStyle}
      loading={loading ?? 'lazy'}
      {...({ decoding: 'async', draggable: false } as any)}
    />
  );
}