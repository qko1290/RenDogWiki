// app/components/manager/IconCell.tsx
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

export function IconCell({ icon, size = 24, rounded = 6, alt = 'icon', className }: IconCellProps) {
  if (!icon) return <span className={className} style={{ width: size, height: size }} />;

  if (isImageUrl(icon)) {
    return (
      <img
        src={icon}
        alt={alt}
        className={className}
        style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover' }}
      />
    );
  }
  return (
    <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
