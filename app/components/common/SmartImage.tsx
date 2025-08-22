/** 전체 파일: components/common/SmartImage.tsx
 * - Next/Image 래퍼
 * - width/height 있으면 고정, 없으면 fill로 반응형
 * - 기본 라운드/그림자 스타일 지원
 */
"use client";

import Image from "next/image";
import React from "react";

type Props = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;  // LCP 이미지면 true
  sizes?: string;      // 반응형 sizes
  style?: React.CSSProperties;
  rounded?: number;    // px 단위 라운드
};

export default function SmartImage({
  src,
  alt = "",
  width,
  height,
  className,
  priority = false,
  sizes = "100vw",
  style,
  rounded = 10,
}: Props) {
  const commonStyle = { borderRadius: rounded, ...style };

  if (width && height) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={className}
        priority={priority}
        style={commonStyle}
      />
    );
  }

  // width/height 미지정 → fill 모드
  return (
    <div style={{ position: "relative", width: "100%", minHeight: 40 }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        style={{ objectFit: "contain", ...commonStyle }}
      />
    </div>
  );
}
