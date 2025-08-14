// =============================================
// File: app/components/manager/IconCell.tsx
// =============================================
'use client';

import React from 'react';

type IconCellProps = {
  icon?: string | null;
  size?: number;     // px
  rounded?: number;  // px
  alt?: string;
  className?: string;
};

const isImageUrl = (v?: string | null) => !!v && v.startsWith('http');

/**
 * 목록/디테일 셀에 들어가는 작고 단순한 아이콘 셀
 * - 이미지 URL이면 <img>, 그 외(이모지/문자)면 <span>
 * - 아이콘이 없을 때도 셀 크기를 유지해 레이아웃 흔들림을 방지
 */
export const IconCell = React.memo(function IconCell({
  icon,
  size = 24,
  rounded = 6,
  alt = 'icon',
  className,
}: IconCellProps) {
  // 아이콘이 없더라도 공간을 확보(인라인 요소는 width/height가 적용 안 되므로 inline-block)
  if (!icon) {
    return (
      <span
        className={className}
        style={{ display: 'inline-block', width: size, height: size }}
      />
    );
  }

  if (isImageUrl(icon)) {
    return (
      <img
        src={icon}
        alt={alt}
        className={className}
        width={size}                 // 레이아웃 안정화(CLS 완화)
        height={size}
        loading="lazy"               // 지연 로딩
        decoding="async"             // 디코딩 힌트
        draggable={false}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          objectFit: 'cover',
          display: 'block',          // 이미지 하단 공백 제거
        }}
      />
    );
  }

  // 이모지/문자 아이콘
  return (
    <span
      className={className}
      role="img"
      aria-label={alt}
      style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-block' }}
    >
      {icon}
    </span>
  );
});
