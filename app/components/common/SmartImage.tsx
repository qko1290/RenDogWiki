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
 *
 * ✅ 아이콘 정책
 * - width/height가 숫자로 둘 다 존재하고 max <= 128이면 "아이콘"으로 간주
 *   → unoptimized 강제 + sizes 고정(px) → Transformations 폭발 방지
 *
 * ✅ 본문(큰 이미지) 정책
 * - 아이콘이 아니고 sizes가 비어있으면 기본 sizes를 자동 주입
 *   → 반응형에서 불필요하게 큰 w 다양화(Transformations 증가)를 억제
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
  fill,
  ...rest
}: Props) {
  const proxied = toProxyUrl(src);

  // width/height가 숫자로 둘 다 존재할 때만 아이콘 판정(레이아웃 안정)
  const wNum = typeof width === 'number' ? width : null;
  const hNum = typeof height === 'number' ? height : null;

  const isIcon = wNum !== null && hNum !== null && Math.max(wNum, hNum) <= 128;

  // ✅ 아이콘이면 최적화 강제 OFF
  const finalUnoptimized = isIcon ? true : !!unoptimized;

  // ✅ sizes 계산
  // - 아이콘: sizes를 px로 고정
  // - 본문: sizes가 없으면 기본 sizes 자동 주입 (모바일 100vw, 데스크탑은 content max 폭)
  const CONTENT_MAX_PX = 960;

  const computedSizesForIcon =
    wNum !== null && hNum !== null ? `${Math.max(wNum, hNum)}px` : '128px';

  const computedSizesForContent = (() => {
    // fill 이미지면 실제 화면에서 보통 "컨테이너 폭"을 따르므로 모바일 100vw, 데스크탑은 최대폭 제한
    if (fill) return `(max-width: 768px) 100vw, ${CONTENT_MAX_PX}px`;

    // width가 숫자로 있으면 그 폭이 너무 크더라도 데스크탑 최대폭을 CONTENT_MAX_PX로 제한
    const desktopPx = wNum !== null ? Math.min(wNum, CONTENT_MAX_PX) : CONTENT_MAX_PX;
    return `(max-width: 768px) 100vw, ${desktopPx}px`;
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

  return (
    <Image
      {...rest}
      src={proxied}
      width={width}
      height={height}
      fill={fill}
      sizes={finalSizes}
      unoptimized={finalUnoptimized}
      style={mergedStyle}
      loading={loading ?? 'lazy'}
      // next/image 타입에 decoding/draggable이 명시적으로 없을 수 있어 캐스팅
      {...({ decoding: 'async', draggable: false } as any)}
    />
  );
}