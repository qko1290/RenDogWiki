// File: app/components/common/SmartImage.tsx
'use client';

import React, { CSSProperties } from 'react';
import Image, { type ImageProps } from 'next/image';
import { toProxyUrl } from '@lib/cdn';

type Props = Omit<ImageProps, 'src'> & {
  /** 원본(외부) 이미지 URL */
  src: string;
  /** px 또는 CSS 값(e.g. "1rem"). 지정 시 style.borderRadius에 반영 */
  rounded?: number | string;
  /** (수동) Next Image 최적화 비활성화 */
  unoptimized?: boolean;
};

/**
 * SmartImage
 * - 외부 이미지는 toProxyUrl(...)로 우회
 * - 기본: loading="lazy", decoding="async", draggable=false
 * - ✅ 규칙: width/height가 있고 max <= 128이면 "아이콘"으로 간주 → 최적화(unoptimized) 강제
 *   + 아이콘은 sizes를 고정(px)해서 w 변형(Transformations) 폭발 방지
 */
export default function SmartImage({
  src,
  rounded,
  style,
  unoptimized,
  sizes,
  width,
  height,
  loading,
  ...rest
}: Props) {
  const proxied = toProxyUrl(src);

  // width/height가 숫자로 둘 다 존재할 때만 아이콘 판정(레이아웃 안정)
  const wNum = typeof width === 'number' ? width : null;
  const hNum = typeof height === 'number' ? height : null;

  const isIcon = wNum !== null && hNum !== null && Math.max(wNum, hNum) <= 128;

  // ✅ 아이콘이면 최적화 강제 OFF
  const finalUnoptimized = isIcon ? true : !!unoptimized;

  // ✅ 아이콘이면 sizes 고정(호출부가 sizes를 안 넣어도 변환 폭발 방지)
  const finalSizes =
    isIcon
      ? (sizes ?? `${Math.max(wNum ?? 0, hNum ?? 0)}px`)
      : sizes;

  const mergedStyle: CSSProperties = {
    ...style,
    ...(rounded !== undefined
      ? { borderRadius: typeof rounded === 'number' ? `${rounded}px` : rounded }
      : {}),
  };

  return (
    <Image
      {...rest}
      src={proxied}
      width={width}
      height={height}
      sizes={finalSizes}
      unoptimized={finalUnoptimized}
      style={mergedStyle}
      loading={loading ?? 'lazy'}
      // next/image 타입에 decoding/draggable이 명시적으로 없을 수 있어 캐스팅
      {...({ decoding: 'async', draggable: false } as any)}
    />
  );
}