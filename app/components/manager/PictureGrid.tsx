// app/components/manager/PictureGrid.tsx

'use client';

import React from 'react';

type PictureGridProps = {
  /** 이미지 배열: pictures 또는 urls 아무거나 사용 가능 */
  pictures?: string[];
  urls?: string[];

  /** 썸네일 크기/간격 */
  size?: number;
  gap?: number;

  /** 비었을 때 표시 */
  emptyText?: React.ReactNode;

  /** 삭제/추가 동작(주면 버튼 렌더링) */
  onRemove?: (index: number) => void;
  onAddClick?: () => void;
};

export function PictureGrid({
  pictures,
  urls,
  size = 70,
  gap = 10,
  emptyText,
  onRemove,
  onAddClick,
}: PictureGridProps) {
  const items = (pictures ?? urls ?? []) as string[];

  if (!items.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#bbb' }}>{emptyText ?? '사진 없음'}</span>
        {onAddClick && (
          <button className="npc-modal-image-btn" onClick={onAddClick}>
            + 사진 추가
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      {items.map((url, idx) => (
        <div key={url + idx} style={{ position: 'relative' }}>
          <img
            src={url}
            alt={`pic-${idx}`}
            style={{
              width: size,
              height: size,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid #ccc',
            }}
          />
          {onRemove && (
            <button
              onClick={() => onRemove(idx)}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                border: 'none',
                background: '#fff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                boxShadow: '0 1px 4px #0002',
                cursor: 'pointer',
              }}
              title="삭제"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {onAddClick && (
        <button
          className="npc-modal-image-btn"
          onClick={onAddClick}
          style={{ alignSelf: 'center' }}
        >
          + 사진 추가
        </button>
      )}
    </div>
  );
}