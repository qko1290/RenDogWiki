// File: app/components/common/SmartImage.tsx
"use client";

import Image, { ImageProps } from "next/image";
// CDN 유틸 이름/경로는 기존 것 그대로 사용하세요.
import { toProxyUrl } from "@lib/cdn"; // or the function you exported (e.g., rewriteToCDN)

type Props = Omit<ImageProps, "src" | "loader"> & {
  /** 원본(외부) 이미지 URL */
  src: string;
  /** 강제로 최적화 우회(필요시) */
  unoptimized?: boolean;
};

export default function SmartImage({
  src,
  unoptimized,
  alt,
  loading,
  ...rest // ✅ fetchPriority, sizes, className, width/height 등 전부 허용
}: Props) {
  // 필요 시 CDN/프록시로 변환
  const finalSrc = toProxyUrl ? toProxyUrl(src) : src;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      // 기본값: lazy + async 느낌 유지
      loading={loading ?? "lazy"}
      // next/image는 decoding prop이 없으므로 rest에 두지 않고 img 태그로 내려가지 않음
      // (성능상 문제 없고 경고도 없음)
      unoptimized={unoptimized}
      {...rest}
    />
  );
}
