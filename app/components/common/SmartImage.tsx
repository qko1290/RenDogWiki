// File: app/components/common/SmartImage.tsx
import React, { CSSProperties } from "react";
import Image, { ImageProps } from "next/image";
import { toProxyUrl } from "@lib/cdn"; // 이미 추가해두신 함수

type Props = Omit<ImageProps, "src" | "loader"> & {
  /** 원본(외부) 이미지 URL */
  src: string;
  /** px 또는 CSS 값(e.g. "1rem"). 지정 시 style.borderRadius에 반영 */
  rounded?: number | string;
  /** Next Image 최적화 사용 비활성화 여부(필요 시) */
  unoptimized?: boolean;
};

export default function SmartImage({
  src,
  rounded,
  style,
  unoptimized,
  ...rest
}: Props) {
  const proxied = toProxyUrl(src);

  const mergedStyle: CSSProperties = {
    ...style,
    ...(rounded !== undefined
      ? { borderRadius: typeof rounded === "number" ? `${rounded}px` : rounded }
      : {}),
  };

  return (
    <Image
      {...rest}
      src={proxied}
      style={mergedStyle}
      // 로더는 사용하지 않음(도메인 허용과 proxy URL로 처리)
      unoptimized={unoptimized}
    />
  );
}
